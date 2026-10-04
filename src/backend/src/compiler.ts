import { DocumentElementConfig, RepeatableSubItem, Template } from './models';

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

      case 'interactive_list':
      case 'repeatable_list': {
        // Iterative array of editable elements (each element is description - value)
        const subHeadingPrefix = getHeadingPrefix((elem.level || 1) + 1);
        if (Array.isArray(val) && val.length > 0) {
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
        } else if (typeof val === 'string' && val.trim()) {
          lines.push(val.trim());
          lines.push('');
        } else {
          lines.push('_No items added yet._');
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
