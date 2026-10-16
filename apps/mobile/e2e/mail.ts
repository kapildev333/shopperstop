import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { expect } from '@playwright/test'

// Core's stdout, written here by playwright.config.ts. Node side only.
export const coreLog = path.resolve(__dirname, '.tmp/core.log')

type MailLine = { msg?: string; to?: string; subject?: string; body?: string }

// The newest `mail` line to `email` with `subject`: its body's last word is the code core mailed (core's LogMailer).
function newestCode(email: string, subject: string): string | undefined {
  const lines = existsSync(coreLog) ? readFileSync(coreLog, 'utf8').split('\n') : []
  let code: string | undefined
  for (const line of lines) {
    let entry: MailLine
    try {
      entry = JSON.parse(line) as MailLine
    } catch {
      continue // a line still being written, or not a JSON log line
    }
    if (entry.msg === 'mail' && entry.to === email && entry.subject === subject && entry.body) {
      code = entry.body.split(' ').at(-1) // oldest first, so the last match is the newest
    }
  }
  return code
}

// Waits up to 10 seconds for core to mail `email` under `subject`, and returns the code in it.
export async function mailedCode(email: string, subject: string): Promise<string> {
  let code: string | undefined
  await expect
    .poll(() => (code = newestCode(email, subject)), {
      message: `no "${subject}" mail to ${email} in ${coreLog}`,
      timeout: 10_000,
    })
    .not.toBeUndefined()
  return code as string
}
