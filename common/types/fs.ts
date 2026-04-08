export interface FsEntry {
  key: string
  name: string
  size: number
  last_modified: string
}

export interface ListResponse {
  folders: string[]
  files: FsEntry[]
}
