import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Button, ErrorBanner, FormField, Input, Skeleton, StatusMessage, Table } from '@shopperstop/ui'
import { api } from './api'
import { serviceAreasQuery, storeQuery } from './stores'

const pincodePattern = /^[1-9][0-9]{5}$/

// The pincode list editor: edits stay local until "Save pincodes" replaces the whole list with one PUT.
export function ServiceAreas({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient()
  const saved = useQuery(serviceAreasQuery(storeId))
  const [draft, setDraft] = useState<string[]>()
  const [entry, setEntry] = useState('')
  const [entryError, setEntryError] = useState<string>()

  // The alert for a failed save: the other store by name (its id if unreadable) for a conflict, a retry hint otherwise.
  async function problem(error?: { code: string; pincode?: string; storeId?: string }) {
    if (error?.code !== 'conflict' || !error.pincode || !error.storeId) return 'Could not save the pincodes. Try again.'
    const other = error.storeId
    const name = await queryClient.fetchQuery(storeQuery(other)).then((store) => store.name, () => other)
    return `Pincode ${error.pincode} is served by ${name}.`
  }

  const save = useMutation({
    mutationFn: async (pincodes: string[]) => {
      const { data, error } = await api
        .PUT('/admin/stores/{id}/service-areas', { params: { path: { id: storeId } }, body: { pincodes } })
        .catch(() => ({ data: undefined, error: undefined }))
      if (data) return data
      throw new Error(await problem(error?.error))
    },
    onSuccess: (data) => {
      queryClient.setQueryData(serviceAreasQuery(storeId).queryKey, data)
      setDraft(undefined)
    },
  })

  const pincodes = draft ?? saved.data?.pincodes ?? []
  const unsaved = draft !== undefined && draft.join() !== saved.data?.pincodes.join()

  function edit(next: string[]) {
    setDraft(next)
    save.reset()
  }

  function add(event: FormEvent) {
    event.preventDefault()
    const pincode = entry.trim()
    if (!pincodePattern.test(pincode)) return setEntryError('Enter a 6-digit pincode.')
    setEntryError(undefined)
    setEntry('')
    edit([...new Set([...pincodes, pincode])].sort())
  }

  return (
    <section aria-labelledby="pincodes-heading" className="flex flex-col gap-4">
      <h2 id="pincodes-heading" className="text-h2 text-ink">Delivery pincodes</h2>
      {saved.isPending ? (
        <Skeleton variant="table" count={2} />
      ) : saved.isError ? (
        <ErrorBanner message="Could not load the pincodes." onRetry={() => void saved.refetch()} />
      ) : (
        <>
          {pincodes.length === 0 ? (
            <p className="text-body text-ink-muted">No pincodes yet: customers cannot order from this store.</p>
          ) : (
            <Table
              caption="Pincodes"
              rows={pincodes}
              rowKey={(pincode) => pincode}
              columns={[
                { key: 'pincode', header: 'Pincode', cell: (pincode) => <span className="tabular-nums">{pincode}</span> },
                {
                  key: 'remove',
                  header: 'Action',
                  cell: (pincode) => (
                    <Button variant="ghost-danger" aria-label={`Remove ${pincode}`} onClick={() => edit(pincodes.filter((p) => p !== pincode))}>
                      Remove
                    </Button>
                  ),
                },
              ]}
            />
          )}
          <form noValidate onSubmit={add} className="flex items-end gap-2">
            <FormField label="Add pincode" error={entryError}>
              <Input inputMode="numeric" value={entry} onChange={(event) => setEntry(event.target.value)} />
            </FormField>
            <Button type="submit" variant="secondary">Add</Button>
          </form>
          {save.error && <ErrorBanner message={save.error.message} />}
          {unsaved && <StatusMessage tone="warning">Unsaved changes.</StatusMessage>}
          {save.isSuccess && <StatusMessage tone="success">Pincodes saved.</StatusMessage>}
          <div>
            <Button loading={save.isPending} disabled={!unsaved} onClick={() => save.mutate(pincodes)}>Save pincodes</Button>
          </div>
        </>
      )}
    </section>
  )
}
