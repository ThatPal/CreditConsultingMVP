import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createContext, useContext, type PropsWithChildren } from 'react';
import { apiRequest } from '../../auth/api';
import { type PlanItem } from './editor';
import { type ResponseField } from './PlanResponse';

type PreviewResult = {
  items: Array<{ stableKey: string; fields: ResponseField[]; error: string | null }>;
};
const PreviewContext = createContext<UseQueryResult<PreviewResult, Error> | null>(null);
export function PlanResponsePreviewProvider({
  clientId,
  items,
  children,
  enabled,
}: PropsWithChildren<{ clientId: string; items: PlanItem[]; enabled: boolean }>) {
  const payload = {
    items: items
      .filter((item) => item.owner === 'CLIENT')
      .map(({ stableKey, completionMode, outcomeSchema }) => ({
        stableKey,
        completionMode,
        outcomeSchema,
      })),
  };
  const query = useQuery({
    queryKey: ['plan-response-preview', clientId, payload],
    queryFn: () =>
      apiRequest<PreviewResult>(`/api/v1/consultant/clients/${clientId}/plan/response-preview`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    enabled: enabled && payload.items.length > 0,
    staleTime: Infinity,
    retry: false,
  });
  return <PreviewContext.Provider value={query}>{children}</PreviewContext.Provider>;
}
export function PlanResponsePreview({ item }: { item: PlanItem }) {
  const query = useContext(PreviewContext)!;
  const clientOwned =
    item.owner === 'CLIENT' &&
    !['CONSULTANT_VERIFY', 'SYSTEM_VERIFY'].includes(item.completionMode);
  if (!clientOwned)
    return (
      <Typography sx={{ mt: 2 }} variant="body2">
        {item.owner === 'SYSTEM' || item.completionMode === 'SYSTEM_VERIFY'
          ? 'This step is checked automatically.'
          : 'Your consultant completes this checkpoint.'}{' '}
        No client response is requested.
      </Typography>
    );
  if (query.isPending)
    return <Typography role="status">Loading client response preview...</Typography>;
  const form = query.data?.items?.find((result) => result.stableKey === item.stableKey);
  if (query.isError || !form)
    return (
      <Alert
        severity="error"
        action={<Button onClick={() => void query.refetch()}>Retry preview</Button>}
      >
        The response preview could not be loaded.
      </Alert>
    );
  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Typography variant="overline">Client response preview</Typography>
      {form.error ? (
        <Alert severity="warning">{form.error}</Alert>
      ) : (
        <>
          {form.fields.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              required={field.required}
              value=""
              disabled
              select={field.type === 'boolean' || Boolean(field.options)}
              type={['number', 'integer'].includes(field.type) ? 'number' : 'text'}
              multiline={field.type === 'string' && !field.options}
              minRows={field.type === 'string' && !field.options ? 2 : undefined}
              helperText={[
                field.description,
                field.minimum !== undefined ? `Minimum: ${field.minimum}` : '',
                field.maximum !== undefined ? `Maximum: ${field.maximum}` : '',
                field.maxLength ? `Up to ${field.maxLength} characters` : '',
                field.options ? `Choices: ${field.options.join(', ')}` : '',
                field.type === 'boolean' ? 'Choices: Yes, No' : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            >
              {field.type === 'boolean'
                ? [
                    <MenuItem key="yes" value="true">
                      Yes
                    </MenuItem>,
                    <MenuItem key="no" value="false">
                      No
                    </MenuItem>,
                  ]
                : field.options?.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
            </TextField>
          ))}
          {!form.fields.length && (
            <TextField
              label="Optional note for your consultant"
              multiline
              minRows={2}
              value=""
              disabled
            />
          )}
          {item.completionMode === 'CLIENT_REPORT_CONSULTANT_VERIFY' && (
            <Typography variant="body2">
              Your consultant will verify this response before the next dependent step opens.
            </Typography>
          )}
        </>
      )}
      <Typography variant="body2">
        Clients can attach supporting documents or request help. Preview controls are inactive; no
        response or document will be saved.
      </Typography>
    </Stack>
  );
}
