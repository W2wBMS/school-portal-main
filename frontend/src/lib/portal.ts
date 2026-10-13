export type StudentOverview = {
  profile: {
    studentId?: string;
    fullName?: string;
    email?: string;
    programme?: string;
    department?: string;
    level?: string;
    hallResidence?: string;
    cgpa?: number;
    creditsCompleted?: number;
    feeBalance?: number;
    status?: string;
  } | null;
  results: ResultRow[];
  attendance: AttendanceRow[];
  feeLedger: FeeLedgerRow[];
  academicSummary: AcademicSummary;
};

export type ResultRow = { grade: string; score: number; semester: string; level?: string; academicYear?: string; courseId?: { code?: string; title?: string; credits?: number } };
export type AttendanceRow = { percentage: number; courseId?: { code?: string; title?: string } };
export type FeeLedgerRow = { invoiceNumber: string; amountDue: number; amountPaid: number; balance: number; status: string; semester: string };
export type AcademicSummary = { totalCredits: number; cgpa: number; semesters: Array<{ semester: string; level?: string; academicYear?: string; credits: number; gpa: number; results: ResultRow[] }> };

import { API_BASE } from '@/lib/config';
import { parseJsonResponse } from '@/lib/api';

export async function fetchStudentOverview() {
  const token = localStorage.getItem('portal_token') || '';
  const response = await fetch(`${API_BASE}/portal/student-overview`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return await parseJsonResponse<StudentOverview>(response, 'Unable to fetch student overview');
}
