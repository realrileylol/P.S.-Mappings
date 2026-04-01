import type { FieldMapping, MappingValueType } from '../types';

function formatValue(value: MappingValueType): string {
  switch (value.type) {
    case 'null':
      return 'null';
    case 'literal':
      return `'${value.value}'`;
    case 'column':
      return `[${value.name}]`;
    case 'computed':
      return value.expression;
  }
}

export function generateOutput(mappings: FieldMapping[]): string {
  const lines = mappings.map((m, i) => {
    const val = formatValue(m.value);
    const comment = `--${m.templateField}`;
    if (i === 0) {
      return `    ${val} ${comment}`;
    }
    return `    ,${val} ${comment}`;
  });

  return `SELECT\n${lines.join('\n')}`;
}

export function generateADFFormat(mappings: FieldMapping[]): string {
  const lines = mappings.map((m, i) => {
    const val = formatValue(m.value);
    if (i === 0) {
      return `${val}`;
    }
    return `,${val}`;
  });

  return lines.join('\n');
}
