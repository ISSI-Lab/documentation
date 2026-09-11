import { DocumentElementConfig, Template } from './models';

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
    const val = elementsData[elem.id] !== undefined ? elementsData[elem.id] : elem.default_value;
    lines.push(`## ${elem.label}`);
    lines.push('');

    switch (elem.field_type) {
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
