import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { pool } from './db';
import { CompilerType, LatexCompilationError, SynctexPdfLocation, SynctexSourceLocation } from './models';

/**
 * Parses raw LaTeX log output and extracts structured errors and warnings.
 */
export function parseLatexLog(log: string): LatexCompilationError[] {
  const errors: LatexCompilationError[] = [];
  if (!log) return errors;

  const lines = log.split(/\r?\n/);
  let currentFile = 'main.tex';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file context changes like (./sections/intro.tex
    const fileMatch = line.match(/\(((\.?\/)?[\w\-./]+\.(tex|sty|cls|bib))/);
    if (fileMatch && fileMatch[1]) {
      currentFile = path.basename(fileMatch[1]);
    }

    // Detect fatal / critical LaTeX errors
    if (line.startsWith('! ')) {
      const message = line.substring(2).trim();
      let errLine = 1;

      // Scan subsequent lines for line number e.g. "l.24 \undefinedcommand"
      for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
        const lineNumMatch = lines[j].match(/^l\.(\d+)/);
        if (lineNumMatch) {
          errLine = parseInt(lineNumMatch[1], 10);
          break;
        }
      }

      errors.push({
        line: errLine,
        message,
        file: currentFile,
        type: 'error',
      });
    }

    // Detect LaTeX warnings
    else if (line.includes('LaTeX Warning:') || line.includes('Package Warning:')) {
      const lineNumMatch = line.match(/input line (\d+)/i) || line.match(/line (\d+)/i);
      const warnLine = lineNumMatch ? parseInt(lineNumMatch[1], 10) : 1;
      const cleanMsg = line.replace(/^(LaTeX|Package) Warning:\s*/, '').trim();

      errors.push({
        line: warnLine,
        message: cleanMsg,
        file: currentFile,
        type: 'warning',
      });
    }
  }

  return errors;
}

export interface CompileExecutionResult {
  success: boolean;
  compilationId: string;
  logs: string;
  errors: LatexCompilationError[];
  pdfBuffer?: Buffer;
  pdfSize?: number;
}

export interface CompileProjectOptions {
  customDocs?: Array<{ id?: string; name: string; path?: string; content?: string; is_main?: boolean }>;
  customFiles?: Array<{ id?: string; name: string; path?: string; size?: number; mime_type?: string; data?: any; data_base64?: string }>;
}

/**
 * Compiles a LaTeX project in an isolated temporary working directory
 * using TeX Live (pdflatex, xelatex, or lualatex) and stores the result in MySQL.
 */
export async function compileLatexProject(
  projectId: string,
  compilerOverride?: CompilerType,
  mainFileOverride?: string,
  options?: CompileProjectOptions
): Promise<CompileExecutionResult> {
  const compilationId = `comp-${crypto.randomUUID()}`;

  // 1. Fetch project settings
  const [projRows] = await pool.query<any[]>(
    'SELECT * FROM latex_projects WHERE id = ? OR document_id = ?',
    [projectId, projectId]
  );
  if (!projRows || projRows.length === 0) {
    throw new Error(`LaTeX project not found for ID: ${projectId}`);
  }
  const project = projRows[0];
  const activeCompiler: CompilerType = compilerOverride || project.compiler || 'pdflatex';

  // 2. Fetch all text docs
  let docRows: any[] = [];
  if (options?.customDocs && options.customDocs.length > 0) {
    docRows = options.customDocs;
  } else {
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM latex_docs WHERE project_id = ?',
      [project.id]
    );
    docRows = rows;
  }

  // 3. Fetch all binary files
  let fileRows: any[] = [];
  if (options?.customFiles && options.customFiles.length > 0) {
    fileRows = options.customFiles;
  } else {
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM latex_files WHERE project_id = ?',
      [project.id]
    );
    fileRows = rows;
  }

  // 4. Create isolated temporary working directory
  const tempDir = path.join('/tmp', `latex_build_${project.id}_${Date.now()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  try {
    // 5. Write out all document files
    let detectedMainFile = mainFileOverride || 'main.tex';

    for (const doc of docRows) {
      const relPath = (doc.path || doc.name).replace(/^\//, '');
      const fullPath = path.join(tempDir, relPath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, doc.content || '', 'utf8');

      if (doc.is_main || doc.id === project.root_doc_id || doc.name === 'main.tex') {
        detectedMainFile = relPath;
      }
    }

    // 6. Write out all binary files
    for (const f of fileRows) {
      const relPath = (f.path || f.name).replace(/^\//, '');
      const fullPath = path.join(tempDir, relPath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      let buffer: Buffer = Buffer.alloc(0);
      if (Buffer.isBuffer(f.data)) {
        buffer = f.data;
      } else if (f.data_base64) {
        buffer = Buffer.from(f.data_base64, 'base64');
      } else if (typeof f.data === 'string') {
        buffer = Buffer.from(f.data, 'base64');
      }
      await fs.promises.writeFile(fullPath, buffer);
    }

    // Verify main file exists, or select the first .tex file
    const mainFilePath = path.join(tempDir, detectedMainFile);
    if (!fs.existsSync(mainFilePath)) {
      const texFiles = docRows.filter((d: any) => d.name.endsWith('.tex'));
      if (texFiles.length > 0) {
        detectedMainFile = (texFiles[0].path || texFiles[0].name).replace(/^\//, '');
      } else {
        throw new Error('No .tex file found in LaTeX project to compile.');
      }
    }

    const jobName = 'output';
    const compilerExecutable = ['xelatex', 'lualatex'].includes(activeCompiler)
      ? activeCompiler
      : 'pdflatex';

    // Helper to execute compiler command
    const runProcess = (cmd: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> => {
      return new Promise((resolve) => {
        let stdout = '';
        let stderr = '';
        const child = spawn(cmd, args, { cwd: tempDir, env: process.env });

        child.stdout?.on('data', (d) => {
          stdout += d.toString();
        });
        child.stderr?.on('data', (d) => {
          stderr += d.toString();
        });

        // Timeout compile after 45 seconds to avoid infinite loops
        const timer = setTimeout(() => {
          child.kill('SIGKILL');
          stderr += '\nCompilation timed out after 45 seconds.';
        }, 45000);

        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({ stdout, stderr, code: code ?? 1 });
        });
      });
    };

    // First compiler pass with SyncTeX enabled for source-to-pdf and pdf-to-source mapping
    const compileArgs = [
      '-synctex=1',
      '-interaction=batchmode',
      '-halt-on-error',
      `-jobname=${jobName}`,
      detectedMainFile,
    ];

    let runResult = await runProcess(compilerExecutable, compileArgs);

    // Check if bibliography compilation (bibtex) is needed
    const hasBibFile = docRows.some((d: any) => d.name.endsWith('.bib'));
    if (hasBibFile) {
      // Run bibtex output
      await runProcess('bibtex', [jobName]);
      // Second and third passes to resolve citations and references
      await runProcess(compilerExecutable, compileArgs);
      runResult = await runProcess(compilerExecutable, compileArgs);
    }

    // Read compile log
    let logContent = runResult.stdout + '\n' + runResult.stderr;
    const logFilePath = path.join(tempDir, `${jobName}.log`);
    if (fs.existsSync(logFilePath)) {
      try {
        const fileLog = await fs.promises.readFile(logFilePath, 'utf8');
        logContent = fileLog + '\n' + logContent;
      } catch {
        // ignore
      }
    }

    const parsedErrors = parseLatexLog(logContent);
    const pdfPath = path.join(tempDir, `${jobName}.pdf`);
    const success = fs.existsSync(pdfPath);

    let pdfBuffer: Buffer | undefined;
    let pdfSize = 0;
    let synctexBuffer: Buffer | null = null;

    if (success) {
      pdfBuffer = await fs.promises.readFile(pdfPath);
      pdfSize = pdfBuffer.length;

      // Read SyncTeX synchronization file (.synctex.gz or .synctex)
      const synctexGzPath = path.join(tempDir, `${jobName}.synctex.gz`);
      const synctexPlainPath = path.join(tempDir, `${jobName}.synctex`);
      if (fs.existsSync(synctexGzPath)) {
        synctexBuffer = await fs.promises.readFile(synctexGzPath);
      } else if (fs.existsSync(synctexPlainPath)) {
        synctexBuffer = await fs.promises.readFile(synctexPlainPath);
      }

      // Persist to local fast SyncTeX workspace cache for near-instant forward & backward queries
      const cacheDir = path.join('/tmp', 'latex_synctex_cache', project.id);
      try {
        await fs.promises.mkdir(cacheDir, { recursive: true });
        await fs.promises.writeFile(path.join(cacheDir, 'output.pdf'), pdfBuffer);
        if (synctexBuffer) {
          await fs.promises.writeFile(path.join(cacheDir, 'output.synctex.gz'), synctexBuffer);
        }
        for (const doc of docRows) {
          const relPath = (doc.path || doc.name).replace(/^\//, '');
          const fullPath = path.join(cacheDir, relPath);
          await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.promises.writeFile(fullPath, doc.content || '', 'utf8');
        }
      } catch {
        // Non-fatal cache write error
      }

      // Save success compilation with SyncTeX data in MySQL
      await pool.query(
        `INSERT INTO latex_compilations (id, project_id, status, compiler, logs, errors, pdf_data, pdf_size, synctex_data, created_at)
         VALUES (?, ?, 'success', ?, ?, ?, ?, ?, ?, NOW())`,
        [compilationId, project.id, activeCompiler, logContent, JSON.stringify(parsedErrors), pdfBuffer, pdfSize, synctexBuffer]
      );

      return {
        success: true,
        compilationId,
        logs: logContent,
        errors: parsedErrors,
        pdfBuffer,
        pdfSize,
      };
    } else {
      // Save error compilation in MySQL
      await pool.query(
        `INSERT INTO latex_compilations (id, project_id, status, compiler, logs, errors, created_at)
         VALUES (?, ?, 'error', ?, ?, ?, NOW())`,
        [compilationId, project.id, activeCompiler, logContent, JSON.stringify(parsedErrors)]
      );

      return {
        success: false,
        compilationId,
        logs: logContent,
        errors: parsedErrors,
      };
    }
  } finally {
    // 7. Cleanup temp working directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

/**
 * Bundles all files of a LaTeX project into a downloadable .zip archive.
 */
export async function bundleLatexProjectZip(
  projectId: string,
  options?: CompileProjectOptions
): Promise<Buffer> {
  const [projRows] = await pool.query<any[]>(
    'SELECT * FROM latex_projects WHERE id = ? OR document_id = ?',
    [projectId, projectId]
  );
  if (!projRows || projRows.length === 0) {
    throw new Error(`LaTeX project not found for ID: ${projectId}`);
  }
  const project = projRows[0];

  let docRows: any[] = [];
  if (options?.customDocs && options.customDocs.length > 0) {
    docRows = options.customDocs;
  } else {
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM latex_docs WHERE project_id = ?',
      [project.id]
    );
    docRows = rows;
  }

  let fileRows: any[] = [];
  if (options?.customFiles && options.customFiles.length > 0) {
    fileRows = options.customFiles;
  } else {
    const [rows] = await pool.query<any[]>(
      'SELECT * FROM latex_files WHERE project_id = ?',
      [project.id]
    );
    fileRows = rows;
  }

  const tempDir = path.join('/tmp', `latex_zip_${project.id}_${Date.now()}`);
  const zipPath = path.join('/tmp', `bundle_${project.id}_${Date.now()}.zip`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  try {
    for (const doc of docRows) {
      const relPath = (doc.path || doc.name).replace(/^\//, '');
      const fullPath = path.join(tempDir, relPath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.promises.writeFile(fullPath, doc.content || '', 'utf8');
    }

    for (const f of fileRows) {
      const relPath = (f.path || f.name).replace(/^\//, '');
      const fullPath = path.join(tempDir, relPath);
      await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
      let buffer: Buffer = Buffer.alloc(0);
      if (Buffer.isBuffer(f.data)) {
        buffer = f.data;
      } else if (f.data_base64) {
        buffer = Buffer.from(f.data_base64, 'base64');
      } else if (typeof f.data === 'string') {
        buffer = Buffer.from(f.data, 'base64');
      }
      await fs.promises.writeFile(fullPath, buffer);
    }

    // Run zip command
    await new Promise<void>((resolve, reject) => {
      const child = spawn('zip', ['-r', zipPath, '.'], { cwd: tempDir });
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`zip command exited with code ${code}`));
      });
      child.on('error', reject);
    });

    const zipBuffer = await fs.promises.readFile(zipPath);
    return zipBuffer;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    await fs.promises.unlink(zipPath).catch(() => {});
  }
}

/**
 * Ensures the temporary SyncTeX working directory exists with output.pdf, output.synctex.gz,
 * and current source docs to allow fast synctex CLI execution.
 */
export async function ensureSynctexWorkspace(projectId: string, compilationId?: string): Promise<string> {
  const cacheDir = path.join('/tmp', 'latex_synctex_cache', projectId);
  await fs.promises.mkdir(cacheDir, { recursive: true });

  const pdfPath = path.join(cacheDir, 'output.pdf');
  const synctexPath = path.join(cacheDir, 'output.synctex.gz');

  // If both output.pdf and output.synctex.gz exist in cache, we can use them directly
  if (fs.existsSync(pdfPath) && fs.existsSync(synctexPath)) {
    return cacheDir;
  }

  // Otherwise, load from MySQL database
  let query = 'SELECT id, pdf_data, synctex_data FROM latex_compilations WHERE project_id = ? AND status = "success"';
  const params: any[] = [projectId];
  if (compilationId) {
    query += ' AND id = ?';
    params.push(compilationId);
  } else {
    query += ' ORDER BY created_at DESC LIMIT 1';
  }

  const [compRows] = await pool.query<any[]>(query, params);
  if (!compRows || compRows.length === 0 || !compRows[0].pdf_data) {
    throw new Error('No successful compilation with PDF available for SyncTeX mapping');
  }

  const comp = compRows[0];
  await fs.promises.writeFile(pdfPath, comp.pdf_data);
  if (comp.synctex_data) {
    await fs.promises.writeFile(synctexPath, comp.synctex_data);
  }

  // Restore current text docs into the cache folder
  const [docRows] = await pool.query<any[]>('SELECT * FROM latex_docs WHERE project_id = ?', [projectId]);
  for (const doc of docRows || []) {
    const relPath = (doc.path || doc.name).replace(/^\//, '');
    const fullPath = path.join(cacheDir, relPath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, doc.content || '', 'utf8');
  }

  return cacheDir;
}

/**
 * Execute synctex binary safely with timeout
 */
function executeSynctexCli(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn('synctex', args, { cwd, env: process.env });
    child.stdout?.on('data', (d) => {
      output += d.toString();
    });
    child.stderr?.on('data', (d) => {
      output += d.toString();
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(output);
    }, 4000);
    child.on('close', () => {
      clearTimeout(timer);
      resolve(output);
    });
  });
}

/**
 * Parses output from `synctex view` (forward sync / source to PDF)
 */
export function parseSynctexViewOutput(output: string): SynctexPdfLocation | null {
  const pageMatch = output.match(/Page:(\d+)/);
  const xMatch = output.match(/x:([\d.]+)/);
  const yMatch = output.match(/y:([\d.]+)/);
  const hMatch = output.match(/h:([\d.]+)/);
  const vMatch = output.match(/v:([\d.]+)/);
  const wMatch = output.match(/W:([\d.]+)/);
  const heightMatch = output.match(/H:([\d.]+)/);

  if (!pageMatch || !xMatch || !yMatch) return null;

  const page = parseInt(pageMatch[1], 10);
  const x = parseFloat(xMatch[1]);
  const y = parseFloat(yMatch[1]);
  const h = hMatch ? parseFloat(hMatch[1]) : x;
  const v = vMatch ? parseFloat(vMatch[1]) : y;
  const width = wMatch ? parseFloat(wMatch[1]) : 120;
  const height = heightMatch ? parseFloat(heightMatch[1]) : 14;

  return { page, x, y, h, v, width, height };
}

/**
 * Parses output from `synctex edit` (reverse sync / PDF to source)
 */
export function parseSynctexEditOutput(output: string, cacheDir: string): { file: string; line: number; column: number } | null {
  const inputMatch = output.match(/Input:(.+)/);
  const lineMatch = output.match(/Line:(\d+)/);
  const colMatch = output.match(/Column:(-?\d+)/);

  if (!inputMatch || !lineMatch) return null;

  let rawFile = inputMatch[1].trim().replace(/^\.\//, '');
  if (cacheDir && rawFile.startsWith(cacheDir)) {
    rawFile = rawFile.slice(cacheDir.length).replace(/^[/\\]+/, '');
  }
  const tmpMatch = rawFile.match(/\/tmp\/[^/]+\/(.+)$/);
  if (tmpMatch) {
    rawFile = tmpMatch[1];
  }
  rawFile = rawFile.replace(/^\.\//, '');

  const line = parseInt(lineMatch[1], 10);
  const column = colMatch ? Math.max(0, parseInt(colMatch[1], 10)) : 0;

  return { file: rawFile, line, column };
}

/**
 * Forward synchronization: from source line/col to PDF coordinates (Left -> Right)
 */
export async function runSynctexView(
  projectId: string,
  file: string,
  line: number,
  column = 1,
  compilationId?: string
): Promise<SynctexPdfLocation | null> {
  const cacheDir = await ensureSynctexWorkspace(projectId, compilationId);
  const pdfFile = path.join(cacheDir, 'output.pdf');

  // Try the target line first, and if synctex returns nothing (e.g. comment/blank line), check nearby lines
  const tryLines = [line, line + 1, line - 1, line + 2, line - 2].filter((l) => l > 0);
  const cleanFile = file.replace(/^\.\//, '').replace(/^\//, '');
  const baseFile = path.basename(cleanFile);

  for (const l of tryLines) {
    // 1. Try with relative path
    let args = ['view', '-i', `${l}:${column || 1}:${cleanFile}`, '-o', pdfFile];
    let res = await executeSynctexCli(args, cacheDir);
    let parsed = parseSynctexViewOutput(res);
    if (parsed) return parsed;

    // 2. Try with basename if different
    if (baseFile !== cleanFile) {
      args = ['view', '-i', `${l}:${column || 1}:${baseFile}`, '-o', pdfFile];
      res = await executeSynctexCli(args, cacheDir);
      parsed = parseSynctexViewOutput(res);
      if (parsed) return parsed;
    }
  }

  return null;
}

/**
 * Reverse synchronization: from PDF page and click coordinates to source code line/column (Right -> Left)
 */
export async function runSynctexEdit(
  projectId: string,
  page: number,
  x: number,
  y: number,
  compilationId?: string
): Promise<SynctexSourceLocation | null> {
  const cacheDir = await ensureSynctexWorkspace(projectId, compilationId);
  const pdfFile = path.join(cacheDir, 'output.pdf');

  const ptX = Math.round(x);
  const ptY = Math.round(y);

  const args = ['edit', '-o', `${page}:${ptX}:${ptY}:${pdfFile}`];
  const res = await executeSynctexCli(args, cacheDir);
  const parsed = parseSynctexEditOutput(res, cacheDir);
  if (!parsed) return null;

  // Resolve matching doc_id from database
  const [docs] = await pool.query<any[]>(
    'SELECT id, name, path FROM latex_docs WHERE project_id = ?',
    [projectId]
  );

  let matchedDocId: string | null = null;
  const targetFile = parsed.file.toLowerCase();
  const targetBase = path.basename(parsed.file).toLowerCase();

  for (const doc of docs || []) {
    const docPath = (doc.path || doc.name).toLowerCase().replace(/^\//, '');
    const docName = doc.name.toLowerCase();
    if (docPath === targetFile || docName === targetBase || targetFile.endsWith(docPath)) {
      matchedDocId = doc.id;
      break;
    }
  }

  return {
    file: parsed.file,
    doc_id: matchedDocId,
    line: parsed.line,
    column: parsed.column,
  };
}
