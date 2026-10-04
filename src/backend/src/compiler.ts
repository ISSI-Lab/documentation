import { ContainerChildElement, DocumentElementConfig, IterationFieldConfig, RepeatableSubItem, Template } from './models';

function getHeadingPrefix(level: number): string {
  const safeLevel = Math.max(1, Math.min(level || 1, 5));
  // level 1 = ##, level 2 = ###, level 3 = ####
  return '#'.repeat(safeLevel + 1);
}

export function compileDocumentMarkdown(
  title: string,
  status: string,
  author: string,
  tags: string[],
  template: Template | null,
  elementsData: Record<string, any>
): string {
  const lines: string[] = [];

  // Header Title
  lines.push(`# ${title}`);
  lines.push('');

  // Metadata block
  const meta: string[] = [];
  if (template) {
    meta.push(`**Template:** ${template.title}`);
  }
  meta.push(`**Status:** \`${status.toUpperCase()}\``);
  if (author) {
    meta.push(`**Author:** ${author}`);
  }
  if (tags && tags.length > 0) {
    const formattedTags = tags
      .filter((t) => t && t.trim())
      .map((t) => `\`#${t.trim()}\``)
      .join(', ');
    if (formattedTags) {
      meta.push(`**Tags:** ${formattedTags}`);
    }
  }

  lines.push(meta.join(' | '));
  lines.push('');
  lines.push('---');
  lines.push('');

  if (!template || !template.document_elements) {
    for (const [key, val] of Object.entries(elementsData)) {
      const formattedKey = key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      lines.push(`## ${formattedKey}`);
      lines.push('');
      lines.push(String(val || ''));
      lines.push('');
    }
    return lines.join('\n');
  }

  // Sort elements by order
  const sorted = [...template.document_elements].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  );

  for (const elem of sorted) {
    const headingPrefix = getHeadingPrefix(elem.level || 1);
    const val = elementsData[elem.id] !== undefined ? elementsData[elem.id] : elem.default_value;

    lines.push(`${headingPrefix} ${elem.label}`);
    lines.push('');

    // Document elements should contain a pure markdown text element part. Only for viewing.
    if (elem.view_markdown && typeof elem.view_markdown === 'string' && elem.view_markdown.trim()) {
      lines.push(elem.view_markdown.trim());
      lines.push('');
    }

    switch (elem.field_type) {
      case 'pure_markdown': {
        // Pure markdown text element strictly for viewing
        const text = (val !== undefined && val !== null && String(val).trim())
          ? String(val).trim()
          : (elem.view_markdown && elem.view_markdown.trim()) || (elem.default_value && String(elem.default_value).trim()) || '_No content provided._';
        lines.push(text);
        lines.push('');
        break;
      }

      case 'interactive_field': {
        // Interactive element with description portion and input (editing) part
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
          const desc = val.description || elem.description || '';
          const editVal = val.value !== undefined ? String(val.value).trim() : '';
          if (desc) {
            lines.push(`**${desc}:** ${editVal || '_No content provided._'}`);
          } else {
            lines.push(editVal || '_No content provided._');
          }
        } else {
          const text = String(val || '').trim();
          if (elem.description) {
            lines.push(`> ${elem.description}`);
            lines.push('');
          }
          lines.push(text ? text : '_No content provided._');
        }
        lines.push('');
        break;
      }

      case 'iteration_container':
      case 'iteration_group':
      case 'interactive_list':
      case 'repeatable_list': {
        const subHeadingPrefix = getHeadingPrefix((elem.level || 1) + 1);
        const childHeadingPrefix = getHeadingPrefix((elem.level || 1) + 2);

        // Determine configured container children: supports key_value, markdown_text, markdown_readonly
        let containerChildren: ContainerChildElement[] = [];
        if (elem.container_children && Array.isArray(elem.container_children) && elem.container_children.length > 0) {
          containerChildren = elem.container_children;
        } else if (elem.iteration_fields && Array.isArray(elem.iteration_fields) && elem.iteration_fields.length > 0) {
          containerChildren = elem.iteration_fields.map((f, fIdx) => ({
            id: f.id || `child_${fIdx + 1}`,
            type: 'key_value',
            key: f.key,
            label: f.label || f.key,
            description: f.description,
            placeholder: f.placeholder,
            default_value: f.default_value,
          }));
        } else if (Array.isArray(val) && val.length > 0 && val[0]?.values && typeof val[0].values === 'object') {
          containerChildren = Object.keys(val[0].values).map((k, kIdx) => ({
            id: `child_${kIdx + 1}`,
            type: 'key_value',
            key: k,
            label: k,
            description: '',
          }));
        } else {
          containerChildren = [
            { id: 'reason', type: 'key_value', key: 'Reason', label: 'Reason', description: 'Reason for this iteration' },
            { id: 'todo', type: 'key_value', key: 'Todo', label: 'Todo', description: 'Action items to do' },
            { id: 'response', type: 'key_value', key: 'Response', label: 'Response', description: 'Outcome or response' },
          ];
        }

        if (Array.isArray(val) && val.length > 0) {
          // Check if grouped iterations
          if (val[0]?.values !== undefined || val[0]?.iteration_number !== undefined || val[0]?.fields !== undefined) {
            val.forEach((iterItem: any, iterIdx: number) => {
              const iterNum = iterItem.iteration_number || (iterIdx + 1);
              const iterTitle = iterItem.title || `Iteration #${iterNum}`;
              lines.push(`${subHeadingPrefix} ${iterTitle}`);
              lines.push('');

              for (const child of containerChildren) {
                if (child.type === 'markdown_readonly') {
                  const content = child.content?.trim();
                  if (content) {
                    lines.push(content);
                    lines.push('');
                  }
                } else if (child.type === 'markdown_text') {
                  const itemVal = iterItem.values?.[child.id] !== undefined
                    ? iterItem.values[child.id]
                    : (iterItem.values?.[child.label || ''] !== undefined
                      ? iterItem.values[child.label || '']
                      : (iterItem[child.id] ?? child.default_value ?? ''));
                  const textVal = String(itemVal || '').trim();
                  if (child.label) {
                    lines.push(`${childHeadingPrefix} ${child.label}`);
                    lines.push('');
                  }
                  lines.push(textVal || '_No content provided._');
                  lines.push('');
                } else {
                  // key_value item (fixed key edited by template editor, value filled by writer)
                  const keyName = child.key || child.label || child.id || 'Item';
                  const itemVal = iterItem.values?.[keyName] !== undefined
                    ? iterItem.values[keyName]
                    : (iterItem.values?.[child.id] !== undefined
                      ? iterItem.values[child.id]
                      : (iterItem.fields?.find((x: any) => x.key === keyName)?.value ?? iterItem[keyName] ?? child.default_value ?? ''));
                  const textVal = String(itemVal || '').trim();
                  if (textVal.includes('\n')) {
                    lines.push(`- **${keyName}:**`);
                    for (const subLine of textVal.split('\n')) {
                      lines.push(`  ${subLine}`);
                    }
                  } else {
                    lines.push(`- **${keyName}:** ${textVal || '_No content provided._'}`);
                  }
                }
              }
              lines.push('');
            });
          } else {
            // Legacy sub items fallback
            for (const item of val as RepeatableSubItem[]) {
              const itemKey = (item.description && item.description.trim()) ||
                              (item.title && item.title.trim()) ||
                              'Item';
              const itemVal = item.value !== undefined && item.value !== null && String(item.value).trim() !== ''
                ? String(item.value).trim()
                : (item.content && item.content.trim() ? item.content.trim() : '_No details provided._');
              lines.push(`${subHeadingPrefix} ${itemKey}`);
              lines.push('');
              lines.push(itemVal);
              lines.push('');
            }
          }
        } else if (typeof val === 'string' && val.trim()) {
          lines.push(val.trim());
          lines.push('');
        } else {
          lines.push('_No iterations recorded._');
          lines.push('');
        }
        break;
      }

      case 'markdown': {
        const text = String(val || '').trim();
        lines.push(text ? text : '_No content provided._');
        lines.push('');
        break;
      }

      case 'short_text': {
        const text = String(val || '').trim();
        lines.push(text ? text : '_Not specified._');
        lines.push('');
        break;
      }

      case 'select': {
        const text = String(val || '').trim();
        lines.push(`**Selection:** \`${text || 'None'}\``);
        lines.push('');
        break;
      }

      case 'callout': {
        const text = String(val || '').trim();
        if (text) {
          lines.push('> [!NOTE]');
          for (const sub of text.split('\n')) {
            lines.push(`> ${sub}`);
          }
        } else {
          lines.push('> [!NOTE]\n> _No notes provided._');
        }
        lines.push('');
        break;
      }

      case 'code': {
        const text = String(val || '');
        lines.push('```');
        lines.push(text);
        lines.push('```');
        lines.push('');
        break;
      }

      case 'checklist': {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'object' && item !== null) {
              const checked = item.checked ? '[x]' : '[ ]';
              lines.push(`- ${checked} ${item.text || ''}`);
            } else {
              lines.push(`- [ ] ${String(item)}`);
            }
          }
        } else if (typeof val === 'string' && val.trim()) {
          for (const line of val.split('\n')) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
              lines.push(trimmed);
            } else if (trimmed) {
              lines.push(`- [ ] ${trimmed}`);
            }
          }
        } else {
          lines.push('- [ ] _No tasks specified._');
        }
        lines.push('');
        break;
      }

      default: {
        lines.push(String(val || ''));
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
