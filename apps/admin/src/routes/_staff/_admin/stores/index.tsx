import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Badge, Card, EmptyState, ErrorBanner, PageHeader, Price, Skeleton, Table, buttonClass, type Column } from '@shopperstop/ui'
import { storesQuery, type AdminStore } from '../../../../stores'

const columns: Column<AdminStore>[] = [
  {
    key: 'name',
    header: 'Name',
    cell: (store) => (
      <Link to="/stores/$storeId" params={{ storeId: store.id }} className="font-semibold text-accent hover:underline">
        {store.name}
      </Link>
    ),
  },
  { key: 'pincode', header: 'Pincode', cell: (store) => <span className="tabular-nums">{store.pincode}</span> },
  {
    key: 'status',
    header: 'Status',
    cell: (store) => <Badge variant={store.isOpen ? 'success' : 'neutral'}>{store.isOpen ? 'Open' : 'Closed'}</Badge>,
  },
  { key: 'fee', header: 'Delivery fee', cell: (store) => <Price cents={store.deliveryFeeCents} /> },
  { key: 'free', header: 'Free delivery above', cell: (store) => <Price cents={store.freeDeliveryAboveCents} /> },
  { key: 'min', header: 'Minimum order', cell: (store) => <Price cents={store.minOrderCents} /> },
  { key: 'minutes', header: 'Promised time', cell: (store) => <span className="tabular-nums">{store.promisedMinutes} min</span> },
]

function Stores() {
  const stores = useQuery(storesQuery)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Stores" actions={<Link to="/stores/new" className={buttonClass({})}>New store</Link>} />
      {stores.data === undefined ? (
        stores.isError ? (
          <ErrorBanner message="Could not load the stores." onRetry={() => void stores.refetch()} />
        ) : (
          <Skeleton variant="table" count={4} />
        )
      ) : stores.data.items.length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No stores yet" description="Create a store, then add the pincodes it delivers to." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table stack caption="Stores" columns={columns} rows={stores.data.items} rowKey={(store) => store.id} />
        </Card>
      )}
    </div>
  )
}

export const Route = createFileRoute('/_staff/_admin/stores/')({ component: Stores })
