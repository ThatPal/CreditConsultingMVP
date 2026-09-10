import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

type Field = {
  type?: string;
  title?: string;
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
};
export function ResponseSchemaEditor({
  schema,
  disabled,
  onChange,
}: {
  schema: Record<string, unknown> | undefined;
  disabled: boolean;
  onChange: (schema: Record<string, unknown>) => void;
}) {
  const properties = (
    schema?.properties && typeof schema.properties === 'object' ? schema.properties : {}
  ) as Record<string, Field>;
  const required = Array.isArray(schema?.required) ? (schema.required as string[]) : [];
  const write = (next: Record<string, Field>, requirements = required) =>
    onChange({
      type: 'object',
      additionalProperties: false,
      properties: next,
      required: requirements,
    });
  const edit = (key: string, patch: Partial<Field>) =>
    write({ ...properties, [key]: { ...properties[key], ...patch } });
  return (
    <Stack spacing={2}>
      <Typography variant="h3">Response form</Typography>
      <Typography variant="body2" color="text.secondary">
        Ask for the specific information you need. The client sees these labels, and required
        answers are checked before submission.
      </Typography>
      {Object.entries(properties).map(([key, field], index) => (
        <Box key={key} sx={{ borderLeft: 2, borderColor: 'divider', pl: 2 }}>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="body2">Question {index + 1}</Typography>
              <Button
                disabled={disabled}
                onClick={() => {
                  const next = { ...properties };
                  delete next[key];
                  write(
                    next,
                    required.filter((x) => x !== key),
                  );
                }}
              >
                Remove question
              </Button>
            </Stack>
            <TextField
              label="Question label"
              value={field.title ?? key}
              disabled={disabled}
              onChange={(e) => edit(key, { title: e.target.value })}
            />
            <TextField
              select
              label="Answer type"
              value={field.type ?? 'string'}
              disabled={disabled}
              onChange={(e) => {
                write({
                  ...properties,
                  [key]: {
                    title: field.title ?? key,
                    type: e.target.value,
                    ...(e.target.value === 'string' ? { maxLength: 2000 } : {}),
                  },
                });
              }}
            >
              {[
                ['string', 'Text or choice'],
                ['number', 'Number'],
                ['integer', 'Whole number'],
                ['boolean', 'Yes or No'],
              ].map(([value, label]) => (
                <MenuItem key={value} value={value}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Help for the client"
              value={field.description ?? ''}
              disabled={disabled}
              onChange={(e) => edit(key, { description: e.target.value })}
            />
            {field.type === 'string' && (
              <TextField
                label="Choices (optional, one per line)"
                multiline
                minRows={2}
                value={field.enum?.join('\n') ?? ''}
                disabled={disabled}
                onChange={(e) => {
                  const next = { ...field };
                  const options = e.target.value.split('\n');
                  if (e.target.value) next.enum = options;
                  else delete next.enum;
                  write({ ...properties, [key]: next });
                }}
                helperText="Leave empty for a written answer. Choice labels must be nonempty."
              />
            )}
            {['number', 'integer'].includes(field.type ?? '') && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                {(['minimum', 'maximum'] as const).map((bound) => (
                  <TextField
                    key={bound}
                    type="number"
                    label={bound === 'minimum' ? 'Minimum (optional)' : 'Maximum (optional)'}
                    value={field[bound] ?? ''}
                    disabled={disabled}
                    onChange={(e) => {
                      const next = { ...field };
                      if (e.target.value === '') delete next[bound];
                      else next[bound] = Number(e.target.value);
                      write({ ...properties, [key]: next });
                    }}
                  />
                ))}
              </Stack>
            )}
            <FormControlLabel
              control={
                <Checkbox
                  checked={required.includes(key)}
                  disabled={disabled}
                  onChange={(_, checked) =>
                    write(
                      properties,
                      checked ? [...required, key] : required.filter((x) => x !== key),
                    )
                  }
                />
              }
              label="Answer required"
            />
          </Stack>
        </Box>
      ))}
      <Button
        disabled={disabled || Object.keys(properties).length >= 20}
        onClick={() => {
          const key = `answer_${crypto.randomUUID().slice(0, 8)}`;
          write({ ...properties, [key]: { type: 'string', title: '', maxLength: 2000 } }, [
            ...required,
            key,
          ]);
        }}
      >
        Add response question
      </Button>
    </Stack>
  );
}
