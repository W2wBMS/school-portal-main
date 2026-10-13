type ApprovalActor = string | { _id: string; fullName?: string; role?: string } | null;

type ResultApprovalStatusProps = {
  approvals?: { hod?: ApprovalActor; lecturer?: ApprovalActor; admin?: ApprovalActor };
};

export default function ResultApprovalStatus({ approvals }: ResultApprovalStatusProps) {
  const steps = [
    ['HOD', approvals?.hod],
    ['Lecturer', approvals?.lecturer],
    ['Admin', approvals?.admin],
  ] as const;

  return (
    <div aria-label="Result approval status" className="mt-2 flex flex-wrap gap-1.5">
      {steps.map(([label, approver]) => (
        <span
          key={label}
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${approver ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}
        >
          {label}: {approver ? `Approved by ${typeof approver === 'string' ? 'recorded user' : approver.fullName || 'recorded user'}` : 'Not approved'}
        </span>
      ))}
    </div>
  );
}