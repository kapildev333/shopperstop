import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, Dialog, DialogFooter, ErrorBanner, FormField, Input, Select } from '@shopperstop/ui'
import { api, type ApiError } from './api'
import { categoriesQuery, type Category, type CategoryNode } from './catalog'
import { ImageUpload } from './image'

type Field = 'name' | 'parentId' | 'sortOrder'

const messages: Record<Field, string> = {
  name: 'Enter 1 to 100 characters.',
  parentId: 'Choose a top-level category.',
  sortOrder: 'Enter a whole number from 0 to 9999.',
}

// Create (no category) or change a category in a dialog. Every save reloads the tree, which orders it.
export function CategoryDialog({ category, parents, onClose }: { category?: Category; parents: CategoryNode[]; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(category?.name ?? '')
  const [parentId, setParentId] = useState('')
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 0))
  const [sortError, setSortError] = useState<string>()

  const save = useMutation({
    mutationFn: async (order: number) => {
      // PATCH sends only what differs from the loaded category; the parent never changes.
      const { error } = category
        ? await api.PATCH('/admin/categories/{id}', {
            params: { path: { id: category.id } },
            body: { ...(name !== category.name && { name }), ...(order !== category.sortOrder && { sortOrder: order }) },
          })
        : await api.POST('/admin/categories', { body: { name, sortOrder: order, ...(parentId && { parentId }) } })
      if (error) throw error.error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQuery.queryKey })
      onClose()
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const order = sortOrder.trim()
    if (!/^\d{1,4}$/.test(order)) return setSortError(messages.sortOrder)
    setSortError(undefined)
    save.mutate(Number(order))
  }

  const apiError = save.error as Partial<ApiError> | null
  const serverField = apiError?.code === 'validation' && apiError.field && apiError.field in messages ? (apiError.field as Field) : undefined
  const errorFor = (field: Field) => (serverField === field ? messages[field] : undefined)

  return (
    <Dialog open onClose={onClose} title={category ? `Edit ${category.name}` : 'New category'}>
      <form noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {save.error && !serverField && <ErrorBanner message="Could not save the category. Try again." />}
        <FormField label="Name" error={errorFor('name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </FormField>
        {!category && (
          <FormField label="Parent" error={errorFor('parentId')}>
            <Select value={parentId} onChange={(event) => setParentId(event.target.value)}>
              <option value="">None (top level)</option>
              {parents.map((parent) => (
                <option key={parent.id} value={parent.id}>{parent.name}</option>
              ))}
            </Select>
          </FormField>
        )}
        <FormField label="Sort order" hint="Lower numbers come first." error={sortError ?? errorFor('sortOrder')}>
          <Input inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        </FormField>
        {category && <ImageUpload kind="categories" id={category.id} name={category.name} imageUrl={category.imageUrl} />}
        <DialogFooter onCancel={onClose} className="mt-2">
          <Button type="submit" loading={save.isPending}>{category ? 'Save changes' : 'Create category'}</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

// Confirm, then delete; a category with children or products stays and the dialog says why.
export function DeleteCategory({ category, onClose }: { category: Category; onClose: () => void }) {
  const queryClient = useQueryClient()
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await api.DELETE('/admin/categories/{id}', { params: { path: { id: category.id } } })
      if (error) throw error.error
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: categoriesQuery.queryKey })
      onClose()
    },
  })
  const inUse = (remove.error as Partial<ApiError> | null)?.code === 'conflict'

  return (
    <Dialog open onClose={onClose} title={`Delete ${category.name}?`}>
      {remove.error && (
        <ErrorBanner
          className="mt-4"
          message={inUse ? 'This category still has subcategories or products. Move or delete them first.' : 'Could not delete the category. Try again.'}
        />
      )}
      <DialogFooter onCancel={onClose}>
        <Button loading={remove.isPending} onClick={() => remove.mutate()}>Delete</Button>
      </DialogFooter>
    </Dialog>
  )
}
