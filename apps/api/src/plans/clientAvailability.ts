// Read disposition only. Consequential commands revalidate actor/source context.
export function clientItemAvailability(
  plan: { status: string; staleAt?: Date | string | null | undefined },
  item: {
    owner: string;
    type: string;
    status: string;
    completionMode?: string;
    responseForm?: { error: string | null };
  },
) {
  const reason =
    plan.status !== 'ACTIVE' || plan.staleAt
      ? 'PLAN_READ_ONLY'
      : item.owner !== 'CLIENT'
        ? 'OTHER_OWNER'
        : item.type === 'MILESTONE' ||
            !['ACKNOWLEDGEMENT', 'STRUCTURED_OUTCOME', 'CLIENT_REPORT_CONSULTANT_VERIFY'].includes(
              item.completionMode ?? '',
            )
          ? 'VERIFICATION_REQUIRED'
          : !['AVAILABLE', 'IN_PROGRESS'].includes(item.status)
            ? 'STEP_NOT_AVAILABLE'
            : null;
  return {
    canRespond: reason === null,
    canRequestHelp: reason === null,
    canSubmitCompletion: reason === null && !item.responseForm?.error,
    reason: reason ?? (item.responseForm?.error ? 'FORM_CONFIGURATION_REQUIRED' : null),
  };
}
