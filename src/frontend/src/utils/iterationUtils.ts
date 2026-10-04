import {
  ContainerChildElement,
  ContainerChildType,
  DocumentElementConfig,
  IterationFieldConfig,
  IterationGroupItem,
} from '../types';

export const DEFAULT_CONTAINER_CHILDREN: ContainerChildElement[] = [
  {
    id: 'reason',
    type: 'key_value',
    key: 'Reason',
    label: 'Reason',
    description: 'Explanation or root cause',
    placeholder: 'Enter reason...',
    default_value: '',
  },
  {
    id: 'todo',
    type: 'key_value',
    key: 'Todo',
    label: 'Todo',
    description: 'Action items to be taken',
    placeholder: 'Enter action items...',
    default_value: '',
  },
  {
    id: 'response',
    type: 'key_value',
    key: 'Response',
    label: 'Response',
    description: 'Observed outcome or system response',
    placeholder: 'Enter response...',
    default_value: '',
  },
];

export const DEFAULT_ITERATION_FIELDS: IterationFieldConfig[] = DEFAULT_CONTAINER_CHILDREN.map((c) => ({
  id: c.id,
  key: c.key || c.id,
  label: c.label,
  description: c.description,
  placeholder: c.placeholder,
  default_value: c.default_value,
}));

/**
 * Returns true if the element represents an iterative container or legacy iterative group.
 */
export function isIterativeElement(elem: DocumentElementConfig): boolean {
  return (
    elem.field_type === 'iteration_container' ||
    elem.field_type === 'iteration_group' ||
    elem.field_type === 'interactive_list' ||
    elem.field_type === 'repeatable_list' ||
    Boolean(elem.container_children && elem.container_children.length > 0) ||
    Boolean(elem.iteration_fields && elem.iteration_fields.length > 0)
  );
}

/**
 * Extracts and normalizes the child elements inside an iterative container.
 * Supports key_value, markdown_text, and markdown_readonly types.
 */
export function getContainerChildren(elem: DocumentElementConfig): ContainerChildElement[] {
  // If explicitly configured with container_children
  if (elem.container_children && Array.isArray(elem.container_children) && elem.container_children.length > 0) {
    return elem.container_children.map((c, idx) => ({
      id: c.id || `child_${idx + 1}`,
      type: (c.type || 'key_value') as ContainerChildType,
      key: c.key || (c.type === 'key_value' ? (c.label || `Field ${idx + 1}`) : undefined),
      label: c.label || c.key || `Element ${idx + 1}`,
      description: c.description || '',
      placeholder: c.placeholder || '',
      content: c.content || '',
      default_value: c.default_value || '',
    }));
  }

  // If configured with legacy iteration_fields
  if (elem.iteration_fields && Array.isArray(elem.iteration_fields) && elem.iteration_fields.length > 0) {
    return elem.iteration_fields.map((f, idx) => ({
      id: f.id || `field_${idx + 1}`,
      type: 'key_value',
      key: String(f.key || (f as any).label || `Field ${idx + 1}`).trim(),
      label: f.label || f.key,
      description: f.description || '',
      placeholder: f.placeholder || `Enter value for ${f.key}...`,
      default_value: f.default_value || '',
    }));
  }

  // Extract from default_value if available
  if (Array.isArray(elem.default_value) && elem.default_value.length > 0) {
    if (elem.default_value[0]?.values && typeof elem.default_value[0].values === 'object') {
      return Object.keys(elem.default_value[0].values).map((k, idx) => ({
        id: `field_${idx + 1}`,
        type: 'key_value',
        key: k,
        label: k,
        description: `Value for ${k}`,
        placeholder: `Enter ${k}...`,
        default_value: '',
      }));
    }

    const extracted: ContainerChildElement[] = [];
    for (const item of elem.default_value) {
      const k = item.description || item.title || item.key;
      if (k && !extracted.some((f) => f.key === k)) {
        extracted.push({
          id: `field_${extracted.length + 1}`,
          type: 'key_value',
          key: String(k).trim(),
          label: String(k).trim(),
          description: item.placeholder || '',
          placeholder: `Enter ${k}...`,
          default_value: item.value || item.content || '',
        });
      }
    }
    if (extracted.length > 0) return extracted;
  }

  return DEFAULT_CONTAINER_CHILDREN;
}

/**
 * Compatibility helper: Extracts fixed key-value items as IterationFieldConfig.
 */
export function getElementIterationFields(elem: DocumentElementConfig): IterationFieldConfig[] {
  const children = getContainerChildren(elem);
  return children
    .filter((c) => c.type === 'key_value')
    .map((c) => ({
      id: c.id,
      key: c.key || c.label || c.id,
      label: c.label,
      description: c.description,
      placeholder: c.placeholder,
      default_value: c.default_value,
    }));
}

/**
 * Creates an empty iteration cycle containing all elements defined in the container.
 */
export function createEmptyContainerIteration(
  iterationNumber: number,
  children: ContainerChildElement[]
): IterationGroupItem {
  const containerChildren = children.length > 0 ? children : DEFAULT_CONTAINER_CHILDREN;
  const initialValues: Record<string, any> = {};

  for (const child of containerChildren) {
    if (child.type === 'key_value') {
      const k = child.key || child.id;
      initialValues[k] = child.default_value || '';
      // Also map child.id if different
      if (child.id && child.id !== k) {
        initialValues[child.id] = child.default_value || '';
      }
    } else if (child.type === 'markdown_text') {
      initialValues[child.id] = child.default_value || '';
    }
  }

  return {
    id: `iter_${Date.now()}_${iterationNumber}`,
    iteration_number: iterationNumber,
    title: `Iteration #${iterationNumber}`,
    values: initialValues,
    fields: containerChildren
      .filter((c) => c.type === 'key_value')
      .map((c) => ({ key: c.key || c.id, value: initialValues[c.key || c.id] || '' })),
  };
}

/**
 * Legacy alias for backwards compatibility.
 */
export function createEmptyIteration(
  iterationNumber: number,
  configuredFields: IterationFieldConfig[] | ContainerChildElement[]
): IterationGroupItem {
  if (configuredFields.length > 0 && 'type' in configuredFields[0]) {
    return createEmptyContainerIteration(iterationNumber, configuredFields as ContainerChildElement[]);
  }
  const children: ContainerChildElement[] = (configuredFields as IterationFieldConfig[]).map((f) => ({
    id: f.id || f.key.toLowerCase(),
    type: 'key_value',
    key: f.key,
    label: f.label || f.key,
    description: f.description,
    placeholder: f.placeholder,
    default_value: f.default_value,
  }));
  return createEmptyContainerIteration(iterationNumber, children);
}

/**
 * Normalizes iterative container data so that document editors and submission workspaces
 * always work with structured iterations containing the container's elements.
 */
export function getNormalizedContainerIterations(
  rawVal: any,
  children: ContainerChildElement[]
): IterationGroupItem[] {
  const containerChildren = children.length > 0 ? children : DEFAULT_CONTAINER_CHILDREN;

  if (Array.isArray(rawVal)) {
    if (rawVal.length === 0) {
      return [];
    }

    // If already in grouped iteration format
    if (rawVal[0]?.values !== undefined || rawVal[0]?.iteration_number !== undefined || Array.isArray(rawVal[0]?.fields)) {
      return rawVal.map((item: any, idx: number) => {
        const iterNum = item.iteration_number || idx + 1;
        const normalizedValues: Record<string, any> = {};

        for (const child of containerChildren) {
          if (child.type === 'key_value') {
            const k = child.key || child.id;
            const v =
              item.values?.[k] !== undefined
                ? item.values[k]
                : (item.values?.[child.id] !== undefined
                  ? item.values[child.id]
                  : (item.fields?.find((x: any) => x.key === k)?.value ??
                     item[k] ??
                     child.default_value ??
                     ''));
            normalizedValues[k] = String(v ?? '');
            if (child.id && child.id !== k) {
              normalizedValues[child.id] = normalizedValues[k];
            }
          } else if (child.type === 'markdown_text') {
            const v =
              item.values?.[child.id] !== undefined
                ? item.values[child.id]
                : (item.values?.[child.label || ''] !== undefined
                  ? item.values[child.label || '']
                  : (item[child.id] ?? child.default_value ?? ''));
            normalizedValues[child.id] = String(v ?? '');
          }
        }

        return {
          id: item.id || `iter_${idx + 1}`,
          iteration_number: iterNum,
          title: item.title || `Iteration #${iterNum}`,
          values: normalizedValues,
          fields: containerChildren
            .filter((c) => c.type === 'key_value')
            .map((c) => ({ key: c.key || c.id, value: normalizedValues[c.key || c.id] || '' })),
        };
      });
    }

    // If legacy flat array of items (e.g. [{ description: 'Reason', value: '...' }])
    const legacyValues: Record<string, string> = {};
    for (const item of rawVal) {
      const k = item.description || item.title || item.key;
      if (k) {
        legacyValues[String(k).trim()] = String(item.value !== undefined ? item.value : (item.content || ''));
      }
    }

    const finalValues: Record<string, any> = {};
    for (const child of containerChildren) {
      if (child.type === 'key_value') {
        const k = child.key || child.id;
        finalValues[k] = legacyValues[k] !== undefined ? legacyValues[k] : (child.default_value || '');
      } else if (child.type === 'markdown_text') {
        finalValues[child.id] = legacyValues[child.id] !== undefined ? legacyValues[child.id] : (child.default_value || '');
      }
    }

    return [
      {
        id: 'iter_1',
        iteration_number: 1,
        title: 'Iteration #1',
        values: finalValues,
        fields: containerChildren
          .filter((c) => c.type === 'key_value')
          .map((c) => ({ key: c.key || c.id, value: finalValues[c.key || c.id] || '' })),
      },
    ];
  }

  // Not an array -> initialize Iteration #1 with full container elements
  return [createEmptyContainerIteration(1, containerChildren)];
}

/**
 * Legacy alias for backwards compatibility.
 */
export function getNormalizedIterations(
  rawVal: any,
  configuredFields: IterationFieldConfig[] | ContainerChildElement[]
): IterationGroupItem[] {
  if (configuredFields.length > 0 && 'type' in configuredFields[0]) {
    return getNormalizedContainerIterations(rawVal, configuredFields as ContainerChildElement[]);
  }
  const children: ContainerChildElement[] = (configuredFields as IterationFieldConfig[]).map((f) => ({
    id: f.id || f.key.toLowerCase(),
    type: 'key_value',
    key: f.key,
    label: f.label || f.key,
    description: f.description,
    placeholder: f.placeholder,
    default_value: f.default_value,
  }));
  return getNormalizedContainerIterations(rawVal, children);
}
