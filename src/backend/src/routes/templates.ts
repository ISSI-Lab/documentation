import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool, seedDefaultTemplates } from '../db';
import { DocumentElementConfig, Template } from '../models';

export const templatesRouter = Router();

function formatTemplateRow(row: any): Template {
  let elements: DocumentElementConfig[] = [];
  if (typeof row.document_elements === 'string') {
    try {
      elements = JSON.parse(row.document_elements);
    } catch {
      elements = [];
    }
  } else if (Array.isArray(row.document_elements)) {
    elements = row.document_elements;
  }

  // Ensure level property exists
  elements = elements.map((e, idx) => ({
    ...e,
    level: typeof e.level === 'number' ? e.level : 1,
    order: typeof e.order === 'number' ? e.order : idx,
  }));

  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category || 'General',
    icon: row.icon || 'file-text',
    document_elements: elements,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}

// GET /api/v1/templates
templatesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM templates ORDER BY created_at ASC');
    const templates = rows.map(formatTemplateRow);
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve templates', detail: err.message });
  }
});

// GET /api/v1/templates/:id
templatesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const [rows] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [req.params.id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(formatTemplateRow(rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve template', detail: err.message });
  }
});

// POST /api/v1/templates
templatesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, category, icon, document_elements } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Template title is required' });
    }

    const id = `tpl-${crypto.randomBytes(4).toString('hex')}`;
    const cleanElements: DocumentElementConfig[] = Array.isArray(document_elements)
      ? document_elements.map((elem: any, idx: number) => ({
          id: elem.id || `elem_${idx + 1}`,
          label: elem.label || `Section ${idx + 1}`,
          description: elem.description || '',
          field_type: elem.field_type || 'markdown',
          level: typeof elem.level === 'number' ? Math.max(1, Math.min(elem.level, 4)) : 1,
          placeholder: elem.placeholder || '',
          default_value: elem.default_value !== undefined ? elem.default_value : '',
          required: Boolean(elem.required),
          order: idx,
          options: Array.isArray(elem.options) ? elem.options : null,
        }))
      : [];

    await pool.query(
      `INSERT INTO templates (id, title, description, category, icon, document_elements, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        id,
        title.trim(),
        description || '',
        category || 'General',
        icon || 'file-text',
        JSON.stringify(cleanElements),
      ]
    );

    const [createdRows] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [id]);
    res.status(201).json(formatTemplateRow(createdRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create template', detail: err.message });
  }
});

// PUT /api/v1/templates/:id
templatesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [id]);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const current = existing[0];
    const { title, description, category, icon, document_elements } = req.body;

    let elementsJson = current.document_elements;
    if (document_elements !== undefined) {
      const cleanElements = Array.isArray(document_elements)
        ? document_elements.map((elem: any, idx: number) => ({
            id: elem.id || `elem_${idx + 1}`,
            label: elem.label || `Section ${idx + 1}`,
            description: elem.description || '',
            field_type: elem.field_type || 'markdown',
            level: typeof elem.level === 'number' ? Math.max(1, Math.min(elem.level, 4)) : 1,
            placeholder: elem.placeholder || '',
            default_value: elem.default_value !== undefined ? elem.default_value : '',
            required: Boolean(elem.required),
            order: idx,
            options: Array.isArray(elem.options) ? elem.options : null,
          }))
        : [];
      elementsJson = JSON.stringify(cleanElements);
    } else if (typeof elementsJson !== 'string') {
      elementsJson = JSON.stringify(elementsJson);
    }

    await pool.query(
      `UPDATE templates 
       SET title = ?, description = ?, category = ?, icon = ?, document_elements = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        title !== undefined ? title.trim() : current.title,
        description !== undefined ? description : current.description,
        category !== undefined ? category : current.category,
        icon !== undefined ? icon : current.icon,
        elementsJson,
        id,
      ]
    );

    const [updatedRows] = await pool.query<any[]>('SELECT * FROM templates WHERE id = ?', [id]);
    res.json(formatTemplateRow(updatedRows[0]));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update template', detail: err.message });
  }
});

// DELETE /api/v1/templates/:id
templatesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [result]: any = await pool.query('DELETE FROM templates WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete template', detail: err.message });
  }
});

// POST /api/v1/templates/actions/reset-seeds
templatesRouter.post('/actions/reset-seeds', async (req: Request, res: Response) => {
  try {
    await seedDefaultTemplates();
    const [rows] = await pool.query<any[]>('SELECT * FROM templates ORDER BY created_at ASC');
    res.json(rows.map(formatTemplateRow));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset seed templates', detail: err.message });
  }
});
