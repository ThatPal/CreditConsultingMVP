import { AppError } from '../http/errors.js';

export type ResponseField = {
  key: string;
  label: string;
  type: 'string' | 'number' | 'integer' | 'boolean';
  required: boolean;
  description?: string;
  options?: string[];
  minimum?: number;
  maximum?: number;
  maxLength?: number;
};
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

// A deliberately bounded schema dialect. Unsupported constraints must not be
// silently accepted by either publication or submission.
export function responseFields(schema: unknown): ResponseField[] {
  const invalid = () =>
    new AppError(
      'PLAN_RESPONSE_SCHEMA_INVALID',
      422,
      'The response form needs consultant configuration before this step can be submitted.',
    );
  if (!record(schema) || schema.type !== 'object' || !record(schema.properties)) throw invalid();
  if (
    Object.keys(schema).some(
      (key) => !['type', 'properties', 'required', 'additionalProperties'].includes(key),
    )
  )
    throw invalid();
  if (schema.additionalProperties !== undefined && schema.additionalProperties !== false)
    throw invalid();
  const required = schema.required ?? [];
  if (
    !Array.isArray(required) ||
    required.some(
      (key) => typeof key !== 'string' || !Object.hasOwn(schema.properties as object, key),
    )
  )
    throw invalid();
  const entries = Object.entries(schema.properties);
  if (!entries.length || entries.length > 20) throw invalid();
  return entries.map(([key, field]) => {
    if (
      !/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key) ||
      ['constructor', 'prototype'].includes(key) ||
      !record(field)
    )
      throw invalid();
    if (
      Object.keys(field).some(
        (name) =>
          !['type', 'title', 'description', 'enum', 'minimum', 'maximum', 'maxLength'].includes(
            name,
          ),
      )
    )
      throw invalid();
    if (!['string', 'number', 'integer', 'boolean'].includes(String(field.type))) throw invalid();
    if (
      field.title !== undefined &&
      (typeof field.title !== 'string' || !field.title.trim() || field.title.length > 160)
    )
      throw invalid();
    if (
      field.description !== undefined &&
      (typeof field.description !== 'string' || field.description.length > 500)
    )
      throw invalid();
    if (
      field.enum !== undefined &&
      (field.type !== 'string' ||
        !Array.isArray(field.enum) ||
        !field.enum.length ||
        field.enum.length > 30 ||
        field.enum.some((x) => typeof x !== 'string' || !x || x.length > 160))
    )
      throw invalid();
    for (const bound of ['minimum', 'maximum'] as const)
      if (
        field[bound] !== undefined &&
        (!['number', 'integer'].includes(String(field.type)) ||
          typeof field[bound] !== 'number' ||
          !Number.isFinite(field[bound]))
      )
        throw invalid();
    if (
      typeof field.minimum === 'number' &&
      typeof field.maximum === 'number' &&
      field.minimum > field.maximum
    )
      throw invalid();
    if (
      field.maxLength !== undefined &&
      (field.type !== 'string' ||
        !Number.isInteger(field.maxLength) ||
        Number(field.maxLength) < 1 ||
        Number(field.maxLength) > 4000)
    )
      throw invalid();
    return {
      key,
      label: typeof field.title === 'string' ? field.title : key.replace(/_/g, ' '),
      type: field.type as ResponseField['type'],
      required: required.includes(key),
      ...(typeof field.description === 'string' ? { description: field.description } : {}),
      ...(Array.isArray(field.enum) ? { options: field.enum as string[] } : {}),
      ...(typeof field.minimum === 'number' ? { minimum: field.minimum } : {}),
      ...(typeof field.maximum === 'number' ? { maximum: field.maximum } : {}),
      ...(field.type === 'string'
        ? { maxLength: typeof field.maxLength === 'number' ? field.maxLength : 2000 }
        : {}),
    };
  });
}

export function validateResponse(schema: unknown, value: unknown) {
  const fields = responseFields(schema);
  if (!record(value))
    throw new AppError('PLAN_RESPONSE_INVALID', 422, 'Complete the response form.');
  const errors: string[] = [];
  if (Object.keys(value).some((key) => !fields.some((field) => field.key === key)))
    errors.push('Remove fields that are not part of this response form.');
  for (const field of fields) {
    const answer = value[field.key];
    if (answer === undefined || answer === null || (typeof answer === 'string' && !answer.trim())) {
      if (field.required) errors.push(`${field.label} is required.`);
      continue;
    }
    if (field.type === 'boolean' && typeof answer !== 'boolean')
      errors.push(`${field.label} must be Yes or No.`);
    if (
      field.type === 'string' &&
      (typeof answer !== 'string' ||
        answer.length > field.maxLength! ||
        (field.options && !field.options.includes(answer)))
    )
      errors.push(`Choose or enter a valid value for ${field.label}.`);
    if (
      ['number', 'integer'].includes(field.type) &&
      (typeof answer !== 'number' ||
        !Number.isFinite(answer) ||
        (field.type === 'integer' && !Number.isInteger(answer)) ||
        (field.minimum !== undefined && answer < field.minimum) ||
        (field.maximum !== undefined && answer > field.maximum))
    )
      errors.push(`Enter a valid number for ${field.label}.`);
  }
  if (errors.length) throw new AppError('PLAN_RESPONSE_INVALID', 422, errors.join(' '));
}

export function clientResponseForm(schema: unknown, mode: string) {
  if (!['STRUCTURED_OUTCOME', 'CLIENT_REPORT_CONSULTANT_VERIFY'].includes(mode))
    return { fields: [], error: null };
  if (!schema && mode === 'CLIENT_REPORT_CONSULTANT_VERIFY')
    return {
      fields: [
        {
          key: 'clientReport',
          label: 'What did you complete?',
          type: 'string' as const,
          required: true,
          maxLength: 2000,
        },
      ],
      error: null,
    };
  try {
    return { fields: responseFields(schema), error: null };
  } catch {
    return {
      fields: [],
      error: 'Your consultant needs to configure this response form. You can still request help.',
    };
  }
}
