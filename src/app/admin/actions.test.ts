import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduleConfig } from '@/domain/schedule/types';

const rpc = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const singleProfile = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ single: singleProfile }) }) }),
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
  formData.set('config', JSON.stringify(config));
  for (const [key, value] of Object.entries(overrides)) formData.set(key, value);
  return formData;
}

describe('saveSemesterConfig', () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockReset().mockResolvedValue({ data: { user: { id: 'user-1', email: 'admin@example.com' } } });
    singleProfile.mockReset().mockResolvedValue({ data: { role: 'admin' } });
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
    expect(result.error).toBe('Use YYYY-MM-DD.');
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
});
