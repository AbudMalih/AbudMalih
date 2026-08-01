/**
 * Server-side upload validation: file type (by extension AND declared MIME
 * type), file size and file count. Files are held in memory and forwarded
 * as email attachments — they are never written to disk.
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB per file
export const MAX_FILES_PER_SUBMISSION = 5

const ALLOWED: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
}

export interface ValidatedFile {
  filename: string
  content: Buffer
  contentType: string
}

export interface FileValidationResult {
  ok: boolean
  error?: string
  files: ValidatedFile[]
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9äöüÄÖÜß._-]/g, '_').slice(0, 120)
}

export async function validateUploads(files: File[]): Promise<FileValidationResult> {
  if (files.length > MAX_FILES_PER_SUBMISSION) {
    return { ok: false, error: `Maximal ${MAX_FILES_PER_SUBMISSION} Dateien erlaubt.`, files: [] }
  }

  const validated: ValidatedFile[] = []

  for (const file of files) {
    if (file.size === 0) continue

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return { ok: false, error: `Die Datei „${file.name}“ überschreitet die maximale Größe von 10 MB.`, files: [] }
    }

    const ext = ('.' + (file.name.split('.').pop() || '')).toLowerCase()
    const allowedMimes = ALLOWED[ext]

    if (!allowedMimes) {
      return { ok: false, error: `Der Dateityp von „${file.name}“ ist nicht erlaubt. Erlaubt: PDF, DOC, DOCX, XLSX, CSV, JPG, PNG.`, files: [] }
    }

    if (file.type && !allowedMimes.includes(file.type)) {
      return { ok: false, error: `Der Inhaltstyp der Datei „${file.name}“ passt nicht zur Dateiendung.`, files: [] }
    }

    validated.push({
      filename: sanitizeFilename(file.name),
      content: Buffer.from(await file.arrayBuffer()),
      contentType: allowedMimes[0],
    })
  }

  return { ok: true, files: validated }
}
