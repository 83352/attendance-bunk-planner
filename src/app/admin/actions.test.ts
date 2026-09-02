import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleConfig } from '@/domain/schedule/types';

const rpc = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const singleProfile = vi.hoisted(() => vi.fn());
// sectionLookupMock: mocks from('sections').select('name').eq('id', x).single().
// Tests reset it with mockResolvedValueOnce({ data: { name: 'CSE 5' }, error: null }).
const sectionLookupMock = vi.hoisted(() => vi.fn());
// sectionUpdateMock: mocks from('sections').update({ name }).eq('id', x).
// Tests reset it with mockResolvedValueOnce({ error: null }) to allow the rename,
// or { error: { code: '23505', message: 'duplicate' } } to simulate a conflict.
const sectionUpdateMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser },
    from: (table: string) => {
      if (table === 'admin_profiles') return { select: () => ({ eq: () => ({ single: singleProfile }) }) };
      if (table === 'sections') {
        return {
          select: () => ({ eq: () => ({ single: sectionLookupMock }) }),
          update: () => ({ eq: sectionUpdateMock }),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    },
    rpc,
  })),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { saveSemesterConfig } from './actions';

function validFormData(overrides: Record<string, string> = {}) {
  const config: ScheduleConfig = {
    semesterStart: '2026-07-06',
    semesterEnd: '2026-11-07',
    timetable: [{ weekday: 1, sequence: 1, start: '09:10', end: '10:10' }],
    holidays: [],
    specialSaturdays: [],
    exams: [],
  };
  const formData = new FormData();
  formData.set('sectionName', 'CSE 5');
  formData.set('activeSectionId', 'section-1');
  formData.set('config', JSON.stringify(config));
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

describe('saveSemesterConfig', () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1', email: 'admin@example.com' } } });
    singleProfile.mockReset().mockResolvedValue({ data: { role: 'admin' } });
    // Default: the existing section name matches the submitted one, so
    // saveSemesterConfig skips the rename and goes straight to the RPC.
    sectionLookupMock.mockReset().mockResolvedValue({ data: { name: 'CSE 5' }, error: null });
    sectionUpdateMock.mockReset().mockResolvedValue({ error: null });
  });

  it('rejects when Supabase is not configured', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server');
    vi.mocked(createSupabaseServerClient).mockResolvedValueOnce(null);
    const result = await saveSemesterConfig({}, validFormData());
    expect(result.error).toMatch(/not configured/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects an expired session before touching the database', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await saveSemesterConfig({}, validFormData());
    expect(result.error).toMatch(/sign in again/i);
    expect(singleProfile).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects non-admins', async () => {
    singleProfile.mockResolvedValueOnce({ data: null });
    const result = await saveSemesterConfig({}, validFormData());
    expect(result.error).toMatch(/not authorized/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON payloads', async () => {
    const result = await saveSemesterConfig({}, validFormData({ config: '{not json' }));
    expect(result.error).toMatch(/not valid JSON/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects invalid configurations with the first schema message', async () => {
    const formData = new FormData();
    formData.set('sectionName', 'CSE 5');
    formData.set('config', JSON.stringify({ semesterStart: 'nope' }));
    const result = await saveSemesterConfig({}, formData);
    expect(result.error).toBe('Use a valid date in YYYY-MM-DD format.');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects a missing section name', async () => {
    const result = await saveSemesterConfig({}, validFormData({ sectionName: '   ' }));
    expect(result.error).toMatch(/section name is required/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps a missing RPC to the migration hint without throwing', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'Could not find the function public.save_semester_config in the schema cache.', code: '404' } });
    const result = await saveSemesterConfig({}, validFormData());
    expect(result.error).toMatch(/005_atomic_save\.sql/);
    expect(result.success).toBeUndefined();
  });

  it('maps insufficient-privilege errors to the authorization message', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'save_semester_config requires an administrator', code: '42501' } });
    const result = await saveSemesterConfig({}, validFormData());
    expect(result.error).toMatch(/not authorized/i);
  });

  it('passes a null lock timestamp when the section was never saved', async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await saveSemesterConfig({}, validFormData({ updatedAt: '' }));
    expect(rpc.mock.calls[0][1].p_expected_updated_at).toBeNull();
  });

  it('forwards the loaded updated_at timestamp as the optimistic-lock token', async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await saveSemesterConfig({}, validFormData({ updatedAt: '2026-08-20T10:00:00.000Z' }));
    expect(rpc.mock.calls[0][1].p_expected_updated_at).toBe('2026-08-20T10:00:00.000Z');
  });

  it('rejects a malformed lock timestamp before calling the database', async () => {
    const result = await saveSemesterConfig({}, validFormData({ updatedAt: 'not-a-date' }));
    expect(result.error).toMatch(/lock timestamp is invalid/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('maps optimistic-lock conflicts to the reload message', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'The configuration was changed by someone else after you loaded it. Reload and try again.', code: '40001' } });
    const result = await saveSemesterConfig({}, validFormData({ updatedAt: '2026-08-20T10:00:00.000Z' }));
    expect(result.error).toMatch(/saved from somewhere else/i);
    expect(result.success).toBeUndefined();
  });

  it('saves via one atomic rpc call and reports success', async () => {
    rpc.mockResolvedValueOnce({ error: null });
    const result = await saveSemesterConfig({}, validFormData());
    expect(result.success).toMatch(/saved/i);
    expect(result.error).toBeUndefined();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('save_semester_config', expect.objectContaining({
      p_section_name: 'CSE 5',
      p_semester_start: '2026-07-06',
      p_semester_end: '2026-11-07',
    }));
    const payload = rpc.mock.calls[0][1];
    expect(payload.p_timetable).toHaveLength(1);
    expect(payload.p_exams).toEqual([]);
    expect(payload.p_holidays).toEqual([]);
    expect(payload.p_special_saturdays).toEqual([]);
  });

  it('renames the selected section inside the atomic RPC', async () => {
    rpc.mockResolvedValueOnce({ error: null });
    const result = await saveSemesterConfig({}, validFormData({ sectionName: 'CSE 5 (revised)' }));
    expect(result.success).toMatch(/saved/i);
    expect(sectionUpdateMock).not.toHaveBeenCalled();
    expect(rpc.mock.calls[0][1]).toEqual(expect.objectContaining({ p_section_id: 'section-1', p_section_name: 'CSE 5 (revised)' }));
  });

  it('passes a null section ID for a brand-new section', async () => {
    rpc.mockResolvedValueOnce({ error: null });
    await saveSemesterConfig({}, validFormData({ activeSectionId: '' }));
    expect(rpc.mock.calls[0][1].p_section_id).toBeNull();
  });

  it('maps duplicate section names to a friendly error', async () => {
    rpc.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    const result = await saveSemesterConfig({}, validFormData({ sectionName: 'CSE 6' }));
    expect(result.error).toMatch(/already exists/i);
  });
});
