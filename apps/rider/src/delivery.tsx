import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Button, ButtonLink, Card, Dialog, DialogFooter, ErrorBanner, PageHeader, Price, Skeleton, StatusMessage, Table, formatInr } from '@shopperstop/ui'
import { deliveryQuery, rider } from './api'
import { useLocationReport } from './location'
import { NotFound } from './not-found'

// The error a failed call throws is the service's envelope error ({ code, message }); anything else is a network failure.
function refusedWith(error: unknown, code: string) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}

export function DeliveryPage({ deliveryId }: { deliveryId: string }) {
  const queryClient = useQueryClient()
  const query = useQuery(deliveryQuery(deliveryId))
  const delivery = query.data
  const [asking, setAsking] = useState(false)
  const assigned = delivery?.status === 'assigned'
  const report = useLocationReport(assigned)
  const mark = useMutation({
    mutationFn: async () => {
      const { data, error } = await rider.POST('/me/deliveries/{id}/delivered', { params: { path: { id: deliveryId } } })
      if (error) throw error.error
      return data
    },
    onSuccess: (delivered) => {
      queryClient.setQueryData(deliveryQuery(deliveryId).queryKey, delivered)
      void queryClient.invalidateQueries({ queryKey: ['rider', 'deliveries'] })
    },
  })

  if (query.error) {
    if (refusedWith(query.error, 'not_found')) return <NotFound />
    throw query.error
  }
  if (!delivery) return <Skeleton variant="list" count={3} />

  // The dialog stays while the request runs: closing it would hide a delivery that is still being marked.
  function close() {
    if (mark.isPending) return
    setAsking(false)
    mark.reset()
  }

  function confirm() {
    mark.mutate(undefined, {
      onSuccess: () => setAsking(false),
      onError: (error) => {
        // Core refused: the delivery is no longer assigned to this rider. Read it again and let the page say what it is now.
        if (!refusedWith(error, 'conflict')) return
        setAsking(false)
        mark.reset()
        void queryClient.invalidateQueries({ queryKey: deliveryQuery(deliveryId).queryKey })
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={`Order ${delivery.orderNumber}`}
        actions={<Badge variant={assigned ? 'accent' : 'success'}>{assigned ? 'On the way' : 'Delivered'}</Badge>}
      />
      {assigned && delivery.paymentMethod === 'cod' && (
        <StatusMessage>{`Collect ${formatInr(delivery.totalCents)} cash`}</StatusMessage>
      )}
      {mark.isSuccess && <StatusMessage tone="success">{`${delivery.orderNumber} delivered.`}</StatusMessage>}
      {report && <StatusMessage tone="warning">{report}</StatusMessage>}
      <Card className="flex flex-col gap-2 p-4">
        <section aria-labelledby="delivery-customer" className="flex flex-col gap-2">
          <h2 id="delivery-customer" className="text-h3">Customer</h2>
          <p>{delivery.customerName}</p>
          <p>
            {delivery.address.line1}
            {delivery.address.line2 && `, ${delivery.address.line2}`}, <span className="tabular-nums">{delivery.address.pincode}</span>
          </p>
          {delivery.customerPhone && (
            <ButtonLink href={`tel:${delivery.customerPhone}`} size="lg" className="w-full">
              Call {delivery.customerName}
            </ButtonLink>
          )}
        </section>
      </Card>
      <Table
        stack
        caption="Items"
        rows={delivery.items}
        rowKey={(item) => `${item.name} ${item.unitLabel}`}
        columns={[
          { key: 'product', header: 'Product', cell: (item) => item.name },
          { key: 'unit', header: 'Unit', cell: (item) => item.unitLabel },
          { key: 'quantity', header: 'Quantity', cell: (item) => <span className="tabular-nums">{item.quantity}</span> },
        ]}
      />
      <p className="flex items-center justify-between text-body text-ink">
        <span className="font-semibold">Total</span>
        <Price cents={delivery.totalCents} />
      </p>
      {assigned && (
        <Button size="lg" className="w-full" onClick={() => setAsking(true)}>
          Mark delivered
        </Button>
      )}
      <Dialog open={asking} onClose={close} title={`Mark ${delivery.orderNumber} delivered?`}>
        {mark.isError && <ErrorBanner message="Could not mark the order delivered. Try again." />}
        <DialogFooter onCancel={close}>
          <Button loading={mark.isPending} onClick={confirm}>
            Mark delivered
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
