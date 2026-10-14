import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { Button, Card, EmptyState, ErrorBanner, PageHeader, Skeleton, Table, cn, type Column } from '@shopperstop/ui'
import { CategoryDialog, DeleteCategory } from '../../../categories'
import { categoriesQuery, type Category } from '../../../catalog'
import { ImageTile } from '../../../image'

type Row = Category & { parentName?: string }

function Categories() {
  const tree = useQuery(categoriesQuery)
  const [editing, setEditing] = useState<Category | 'new'>()
  const [deleting, setDeleting] = useState<Category>()
  const parents = tree.data?.items ?? []
  // The tree as rows in core's order: each parent, then its children.
  const rows: Row[] = parents.flatMap(({ children, ...parent }) => [parent, ...children.map((child) => ({ ...child, parentName: parent.name }))])

  const columns: Column<Row>[] = [
    { key: 'image', header: 'Image', cell: (row) => <ImageTile src={row.imageUrl} className="w-10" /> },
    {
      key: 'name',
      header: 'Name',
      cell: (row) => <span className={cn(row.parentId ? 'sm:pl-6' : 'font-semibold')}>{row.name}</span>,
    },
    { key: 'parent', header: 'Parent', cell: (row) => row.parentName ?? 'Top level' },
    { key: 'sort', header: 'Sort order', cell: (row) => <span className="tabular-nums">{row.sortOrder}</span> },
    {
      key: 'actions',
      header: 'Actions',
      cell: (row) => (
        <span className="flex gap-2">
          <Button variant="ghost" aria-label={`Edit ${row.name}`} onClick={() => setEditing(row)}>Edit</Button>
          <Button variant="ghost-danger" aria-label={`Delete ${row.name}`} onClick={() => setDeleting(row)}>Delete</Button>
        </span>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Categories" actions={<Button onClick={() => setEditing('new')}>New category</Button>} />
      {tree.isPending ? (
        <Skeleton variant="table" count={6} />
      ) : tree.isError ? (
        <ErrorBanner message="Could not load the categories." onRetry={() => void tree.refetch()} />
      ) : rows.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No categories yet" description="Create a top-level category, then its subcategories." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table stack caption="Categories" columns={columns} rows={rows} rowKey={(row) => row.id} />
        </Card>
      )}
      {editing && (
        <CategoryDialog category={editing === 'new' ? undefined : editing} parents={parents} onClose={() => setEditing(undefined)} />
      )}
      {deleting && <DeleteCategory category={deleting} onClose={() => setDeleting(undefined)} />}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/categories')({ component: Categories })
