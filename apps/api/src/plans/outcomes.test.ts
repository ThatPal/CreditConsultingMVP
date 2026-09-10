import { expect, test } from 'vitest';
import { responseFields, validateResponse } from './outcomes.js';
const schema = {
  type: 'object',
  properties: {
    balance: { type: 'number', title: 'Current balance', minimum: 0, maximum: 50000 },
    confirmed: { type: 'boolean', title: 'Confirmed' },
    choice: { type: 'string', enum: ['A', 'B'] },
  },
  required: ['balance', 'confirmed'],
};
test('keeps zero and false as explicit answers', () => {
  expect(() => validateResponse(schema, { balance: 0, confirmed: false })).not.toThrow();
  expect(responseFields(schema)[0]).toMatchObject({
    label: 'Current balance',
    required: true,
    minimum: 0,
  });
});
test.each([
  { balance: -1, confirmed: true },
  { balance: '0', confirmed: true },
  { balance: Infinity, confirmed: true },
  { balance: 10 },
  { balance: 10, confirmed: 'false' },
  { balance: 10, confirmed: false, choice: 'C' },
  { balance: 10, confirmed: false, unknown: 1 },
])('rejects invalid or extra answers %j', (answer) => {
  expect(() => validateResponse(schema, answer)).toThrow();
});
test.each([
  { type: 'object', properties: { a: { type: 'string', pattern: '.+' } } },
  { required: ['balance'] },
  { type: 'object', properties: { a: { type: 'object' } } },
  { type: 'object', properties: { a: { type: 'string' } }, required: ['missing'] },
])('rejects unsupported or malformed schema %j', (value) => {
  expect(() => responseFields(value)).toThrow();
});
