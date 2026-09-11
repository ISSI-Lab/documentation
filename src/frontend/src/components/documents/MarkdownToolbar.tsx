import React from 'react';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListTodo,
  Code,
  Quote,
  Table,
  Link as LinkIcon,
} from 'lucide-react';

interface MarkdownToolbarProps {
  onInsert: (prefix: string, suffix?: string, defaultText?: string) => void;
}

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({ onInsert }) => {
  return (
    <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-slate-100/80 border-b border-slate-200 rounded-t-lg text-slate-700">
      <button
        type="button"
        title="Heading 2"
        onClick={() => onInsert('## ', '', 'Section Title')}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <Heading2 className="w-4 h-4" />
      </button>

      <button
        type="button"
        title="Heading 3"
        onClick={() => onInsert('### ', '', 'Subsection')}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <Heading3 className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-slate-300 mx-1" />

      <button
        type="button"
        title="Bold (Ctrl+B)"
        onClick={() => onInsert('**', '**', 'bold text')}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <Bold className="w-4 h-4" />
      </button>

      <button
        type="button"
        title="Italic (Ctrl+I)"
        onClick={() => onInsert('*', '*', 'italic text')}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <Italic className="w-4 h-4" />
      </button>

      <button
        type="button"
        title="Inline Code"
        onClick={() => onInsert('`', '`', 'code')}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <Code className="w-4 h-4" />
      </button>

      <div className="h-4 w-px bg-slate-300 mx-1" />

      <button
        type="button"
        title="Bullet List"
        onClick={() => onInsert('- ', '', 'List item')}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <List className="w-4 h-4" />
      </button>

      <button
        type="button"
        title="Task Checklist"
        onClick={() => onInsert('- [ ] ', '', 'Task item')}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <ListTodo className="w-4 h-4" />
      </button>

      <button
        type="button"
        title="Quote Callout"
        onClick={() => onInsert('> ', '', 'Quoted note')}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <Quote className="w-4 h-4" />
      </button>

      <button
        type="button"
        title="Insert Table"
        onClick={() =>
          onInsert(
            '\n| Header 1 | Header 2 |\n| :--- | :--- |\n| Value 1 | Value 2 |\n'
          )
        }
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <Table className="w-4 h-4" />
      </button>

      <button
        type="button"
        title="Link"
        onClick={() => onInsert('[', '](https://example.com)', 'link text')}
        className="p-1.5 rounded hover:bg-slate-200 text-slate-700 transition-colors"
      >
        <LinkIcon className="w-4 h-4" />
      </button>
    </div>
  );
};
