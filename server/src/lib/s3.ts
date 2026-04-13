import { AwsClient } from 'aws4fetch'
import type { Env } from '../index'

export function createR2Client(env: Env): AwsClient {
  return new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    region: env.R2_REGION,
    service: 's3',
  })
}

function bucketUrl(env: Env): string {
  return `${env.R2_ENDPOINT}/${env.R2_BUCKET}`
}

// ---- Presigned URLs ----

export async function getUploadUrl(
  client: AwsClient,
  env: Env,
  key: string,
  contentType: string,
  expiresIn = 600,
): Promise<string> {
  const url = new URL(`${bucketUrl(env)}/${key}`)
  url.searchParams.set('X-Amz-Expires', String(expiresIn))
  const signed = await client.sign(url.toString(), {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    aws: { signQuery: true },
  })
  return signed.url
}

export async function getDownloadUrl(
  client: AwsClient,
  env: Env,
  key: string,
  expiresIn = 600,
  inline = false,
): Promise<string> {
  const url = new URL(`${bucketUrl(env)}/${key}`)
  url.searchParams.set('X-Amz-Expires', String(expiresIn))
  if (!inline) {
    const filename = key.split('/').pop() ?? 'download'
    url.searchParams.set('response-content-disposition', `attachment; filename="${filename}"`)
  }
  const signed = await client.sign(url.toString(), {
    method: 'GET',
    aws: { signQuery: true },
  })
  return signed.url
}

// ---- List ----

export interface ListResult {
  folders: string[]
  files: { key: string; name: string; size: number; last_modified: string }[]
}

export async function listObjects(
  client: AwsClient,
  env: Env,
  prefix: string,
): Promise<ListResult> {
  const url = new URL(bucketUrl(env))
  url.searchParams.set('list-type', '2')
  url.searchParams.set('prefix', prefix)
  url.searchParams.set('delimiter', '/')

  const res = await client.fetch(url.toString())
  const xml = await res.text()

  // Parse folders (CommonPrefixes)
  const folders: string[] = []
  const prefixRegex = /<CommonPrefixes>\s*<Prefix>([^<]+)<\/Prefix>\s*<\/CommonPrefixes>/g
  let match: RegExpExecArray | null
  while ((match = prefixRegex.exec(xml)) !== null) {
    folders.push(match[1])
  }

  // Parse files (Contents)
  const files: ListResult['files'] = []
  const contentsRegex = /<Contents>([\s\S]*?)<\/Contents>/g
  while ((match = contentsRegex.exec(xml)) !== null) {
    const block = match[1]
    const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1] ?? ''
    if (key.endsWith('/.keep')) continue
    const size = parseInt(block.match(/<Size>([^<]+)<\/Size>/)?.[1] ?? '0', 10)
    const lastMod = block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? ''
    files.push({
      key,
      name: key.slice(key.lastIndexOf('/') + 1),
      size,
      last_modified: lastMod,
    })
  }

  return { folders, files }
}

// ---- Put empty (mkdir) ----

export async function putEmpty(
  client: AwsClient,
  env: Env,
  key: string,
): Promise<void> {
  await client.fetch(`${bucketUrl(env)}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Length': '0' },
    body: '',
  })
}

// ---- Delete ----

export async function deleteObject(
  client: AwsClient,
  env: Env,
  key: string,
): Promise<void> {
  await client.fetch(`${bucketUrl(env)}/${key}`, { method: 'DELETE' })
}

export async function deletePrefix(
  client: AwsClient,
  env: Env,
  prefix: string,
): Promise<void> {
  // List all objects under prefix, then delete them
  let continuationToken: string | undefined

  do {
    const url = new URL(bucketUrl(env))
    url.searchParams.set('list-type', '2')
    url.searchParams.set('prefix', prefix)
    if (continuationToken) {
      url.searchParams.set('continuation-token', continuationToken)
    }

    const res = await client.fetch(url.toString())
    const xml = await res.text()

    const keys: string[] = []
    const keyRegex = /<Contents>\s*<Key>([^<]+)<\/Key>/g
    let m: RegExpExecArray | null
    while ((m = keyRegex.exec(xml)) !== null) {
      keys.push(m[1])
    }

    // Batch delete
    if (keys.length > 0) {
      const deleteXml = `<?xml version="1.0" encoding="UTF-8"?><Delete>${keys.map((k) => `<Object><Key>${k}</Key></Object>`).join('')}<Quiet>true</Quiet></Delete>`
      await client.fetch(`${bucketUrl(env)}/?delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: deleteXml,
      })
    }

    const isTruncated = xml.includes('<IsTruncated>true</IsTruncated>')
    continuationToken = isTruncated
      ? xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
      : undefined
  } while (continuationToken)
}

// ---- Copy (for move) ----

export async function copyObject(
  client: AwsClient,
  env: Env,
  src: string,
  dst: string,
): Promise<void> {
  await client.fetch(`${bucketUrl(env)}/${dst}`, {
    method: 'PUT',
    headers: { 'x-amz-copy-source': `/${env.R2_BUCKET}/${src}` },
  })
}
