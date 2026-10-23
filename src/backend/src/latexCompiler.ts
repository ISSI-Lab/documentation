import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import crypto from 'crypto';
import { pool } from './db';
import { CompilerType, LatexCompilationError } from './models';

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

/**
 * Compiles a LaTeX project in an isolated temporary working directory
 * using TeX Live (pdflatex, xelatex, or lualatex) and stores the result in MySQL.
 */
export async function compileLatexProject(
  projectId: string,
  compilerOverride?: CompilerType,
  mainFileOverride?: string
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
  const [docRows] = await pool.query<any[]>(
    'SELECT * FROM latex_docs WHERE project_id = ?',
    [project.id]
  );

  // 3. Fetch all binary files
  const [fileRows] = await pool.query<any[]>(
    'SELECT * FROM latex_files WHERE project_id = ?',
    [project.id]
  );

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
      const buffer = Buffer.isBuffer(f.data)
        ? f.data
        : typeof f.data === 'string'
        ? Buffer.from(f.data, 'base64')
        : Buffer.alloc(0);
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

    // First compiler pass
    const compileArgs = [
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

    if (success) {
      pdfBuffer = await fs.promises.readFile(pdfPath);
      pdfSize = pdfBuffer.length;

      // Save success compilation in MySQL
      await pool.query(
        `INSERT INTO latex_compilations (id, project_id, status, compiler, logs, errors, pdf_data, pdf_size, created_at)
         VALUES (?, ?, 'success', ?, ?, ?, ?, ?, NOW())`,
        [compilationId, project.id, activeCompiler, logContent, JSON.stringify(parsedErrors), pdfBuffer, pdfSize]
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
export async function bundleLatexProjectZip(projectId: string): Promise<Buffer> {
  const [projRows] = await pool.query<any[]>(
    'SELECT * FROM latex_projects WHERE id = ? OR document_id = ?',
    [projectId, projectId]
  );
  if (!projRows || projRows.length === 0) {
    throw new Error(`LaTeX project not found for ID: ${projectId}`);
  }
  const project = projRows[0];

  const [docRows] = await pool.query<any[]>(
    'SELECT * FROM latex_docs WHERE project_id = ?',
    [project.id]
  );
  const [fileRows] = await pool.query<any[]>(
    'SELECT * FROM latex_files WHERE project_id = ?',
    [project.id]
  );

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
      const buffer = Buffer.isBuffer(f.data)
        ? f.data
        : typeof f.data === 'string'
        ? Buffer.from(f.data, 'base64')
        : Buffer.alloc(0);
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
