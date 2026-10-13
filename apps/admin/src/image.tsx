import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type ChangeEvent } from 'react'
import { ErrorBanner, FormField, StatusMessage, cn } from '@shopperstop/ui'
import { api, type ApiError } from './api'

// A 1:1 image tile; the placeholder stands in until an image is uploaded.
// ponytail: an app-level recipe with an empty placeholder (no icon: lucide-react is not an apps/admin dependency); replace with the packages/ui ImageTile when ui adds it.
export function ImageTile({ src, alt = '', className }: { src?: string; alt?: string; className?: string }) {
  return (
    <div className={cn('aspect-square shrink-0 overflow-hidden rounded-control border border-line bg-surface', className)}>
      {src ? (
        <img src={src} alt={alt} className="size-full object-contain" />
      ) : (
        <div data-placeholder className="size-full bg-canvas" />
      )}
    </div>
  )
}

const types = ['image/png', 'image/jpeg', 'image/webp']
const maxBytes = 5 * 1024 * 1024
const fileMessage = 'Choose a PNG, JPEG or WebP image of at most 5 MB.'

// Picks an image and uploads it at once with one multipart PUT; the tile shows what core stored.
export function ImageUpload({ kind, id, name, imageUrl }: { kind: 'products' | 'categories'; id: string; name: string; imageUrl?: string }) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState(imageUrl)
  // A re-upload of the same type keeps the URL; the counter makes the browser load the new bytes.
  const [version, setVersion] = useState(0)
  const [fileError, setFileError] = useState<string>()

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const options = {
        params: { path: { id } },
        // openapi-typescript types a binary part as string; the serializer sends the File itself.
        body: { file: file as unknown as string },
        bodySerializer: (body: { file: string }) => {
          const form = new FormData()
          form.append('file', body.file)
          return form
        },
      }
      const { data, error } =
        kind === 'products'
          ? await api.PUT('/admin/products/{id}/image', options)
          : await api.PUT('/admin/categories/{id}/image', options)
      if (error) throw error.error
      return data
    },
    onSuccess: (saved) => {
      setUrl(saved.imageUrl)
      setVersion((n) => n + 1)
      // The tree, the product lists and this product show the new image on their next read.
      void queryClient.invalidateQueries({ queryKey: ['admin', kind] })
    },
  })

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    // The input stays enabled while an upload runs, so it keeps keyboard focus; a pick in that time is ignored.
    if (upload.isPending) return
    upload.reset()
    if (!file) return
    if (!types.includes(file.type) || file.size > maxBytes) return setFileError(fileMessage)
    setFileError(undefined)
    upload.mutate(file)
  }

  const rejected = (upload.error as Partial<ApiError> | null)?.field === 'file'
  return (
    <div className="flex flex-col gap-3">
      <ImageTile src={url && (version ? `${url}?v=${version}` : url)} alt={`Image of ${name}`} className="w-32" />
      <FormField label="Image" hint="PNG, JPEG or WebP, up to 5 MB. Saved as soon as you pick it." error={fileError ?? (rejected ? fileMessage : undefined)}>
        <input
          type="file"
          accept={types.join(',')}
          onChange={pick}
          className="text-body text-ink file:mr-3 file:h-11 file:rounded-control file:border file:border-line-strong file:bg-surface file:px-4 file:text-button file:text-ink sm:file:h-10"
        />
      </FormField>
      {upload.isError && !rejected && <ErrorBanner message="Could not upload the image. Try again." />}
      {upload.isPending && <StatusMessage>Uploading the image…</StatusMessage>}
      {upload.isSuccess && <StatusMessage tone="success">Image saved.</StatusMessage>}
    </div>
  )
}
