import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useEffect, useEffectEvent, useState } from 'react'
import { Badge, Button, ErrorBanner, Price, Sheet, StatusMessage } from '@shopperstop/ui'
import { itemCount } from './format'
import { deliveryQuery, meQuery, rider, type ApiError, type Offer } from './api'
import { useOnlineReport } from './location'
import { assignedKey, readyKey } from './ready'

// The banner's availability. The state is the rider query's `isOnline` (design Decision 2); the answer is written back into that query.
export function Availability() {
  const queryClient = useQueryClient()
  const online = useQuery(meQuery).data?.isOnline ?? false
  const [message, setMessage] = useState<string>()

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { data, error } = await rider.PUT('/me/availability', { body: { online: next } })
      if (error) throw error.error
      return data
    },
    onSuccess: (answered) => queryClient.setQueryData(meQuery.queryKey, answered),
    onError: () => setMessage('Could not change your status. Try again.'),
  })

  useOnlineReport(online, () => {
    setMessage('Allow location to go online')
    toggle.mutate(false)
  })

  return (
    <>
      <Badge variant={online ? 'success' : 'neutral'}>{online ? 'Online' : 'Offline'}</Badge>
      <Button
        variant="secondary"
        loading={toggle.isPending}
        onClick={() => {
          setMessage(undefined)
          toggle.mutate(!online)
        }}
      >
        {online ? 'Go offline' : 'Go online'}
      </Button>
      {message && (
        <StatusMessage tone="warning" className="basis-full">
          {message}
        </StatusMessage>
      )}
    </>
  )
}

// Seconds until the offer expires, on the device clock (design Decision 7).
// ponytail: device clock against the server's expiresAt; a skewed phone shows a wrong count.
function secondsLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 1000))
}

// Keyed by the offer id in the sheet, so each offer starts its own countdown.
function OfferBody({
  offer,
  accepting,
  onAccept,
  onDecline,
  onExpire,
}: {
  offer: Offer
  accepting: boolean
  onAccept: () => void
  onDecline: () => void
  onExpire: () => void
}) {
  const [left, setLeft] = useState(() => secondsLeft(offer.expiresAt))
  const expire = useEffectEvent(onExpire)

  useEffect(() => {
    const timer = setInterval(() => {
      const next = secondsLeft(offer.expiresAt)
      setLeft(next)
      if (next === 0) {
        clearInterval(timer)
        expire()
      }
    }, 1_000)
    return () => clearInterval(timer)
  }, [offer.expiresAt])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-3 text-small text-ink">
        <span>{itemCount(offer.itemCount)}</span>
        <span>
          Pincode <span className="tabular-nums">{offer.pincode}</span>
        </span>
        <span className="tabular-nums">{left} s left</span>
      </div>
      <div className="flex items-center gap-2">
        <Price cents={offer.totalCents} className="text-h3" />
        {offer.paymentMethod === 'cod' && <Badge>Cash</Badge>}
      </div>
      <Button size="lg" className="w-full" loading={accepting} onClick={onAccept}>
        Accept
      </Button>
      <Button size="lg" variant="secondary" className="w-full" disabled={accepting} onClick={onDecline}>
        Decline
      </Button>
    </div>
  )
}

// The offer the rider is shown while online (design Decisions 5 to 8). Mounted only while online: going offline unmounts it, which drops its answer, its status and, with no observer left, the cached offer.
export function OfferSheet() {
  const online = useQuery(meQuery).data?.isOnline ?? false
  return online ? <OnlineOffer /> : null
}

// The offer is read every 3 seconds while mounted; an offer already answered here stays closed.
function OnlineOffer() {
  const [answered, setAnswered] = useState<string>()
  const [status, setStatus] = useState<string>()
  const [seenId, setSeenId] = useState<string>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // ponytail: polling every 3 s, no push or SSE (D57). A failed read shows nothing.
  const offer = useQuery({
    queryKey: ['rider', 'offer'],
    queryFn: async (): Promise<Offer | null> => {
      const { data, error, response } = await rider.GET('/me/offer')
      if (error) throw error.error
      return response.status === 204 ? null : (data ?? null)
    },
    refetchInterval: 3_000,
    gcTime: 0,
    retry: false,
  }).data

  // A new offer clears the last status; an offer going to none does not, so "Someone else took" survives the next 204.
  if (offer && offer.id !== seenId) {
    setSeenId(offer.id)
    setStatus(undefined)
  }

  const open = offer != null && offer.id !== answered

  // Accepting: a 201 opens the delivery; a 409 or 404 means someone else has the order; any other failure keeps the sheet.
  const accept = useMutation({
    mutationFn: async (o: Offer) => {
      const { data, error } = await rider.POST('/me/offers/{id}/accept', { params: { path: { id: o.id } } })
      if (error) throw error.error
      return data
    },
    onSuccess: async (delivery, o) => {
      setAnswered(o.id)
      setStatus(undefined)
      queryClient.setQueryData(deliveryQuery(delivery.id).queryKey, delivery)
      void queryClient.invalidateQueries({ queryKey: readyKey })
      void queryClient.invalidateQueries({ queryKey: assignedKey })
      await navigate({ to: '/deliveries/$deliveryId', params: { deliveryId: delivery.id } })
    },
    onError: (error, o) => {
      const code = (error as Partial<ApiError>).code
      if (code !== 'conflict' && code !== 'not_found') return
      setAnswered(o.id)
      setStatus(`Someone else took ${o.number}.`)
    },
  })

  // ponytail: fire-and-forget decline; a failed decline lets the offer run out its 30 s. Nothing answers while an accept is in flight.
  function decline(o: Offer) {
    if (accept.isPending) return
    setAnswered(o.id)
    setStatus(undefined)
    void rider.POST('/me/offers/{id}/decline', { params: { path: { id: o.id } } }).catch(() => undefined)
  }

  // The countdown reaching 0 does not close a sheet whose accept is in flight: the answer decides.
  function expire(o: Offer) {
    if (accept.isPending) return
    setAnswered(o.id)
    setStatus('Offer expired')
  }

  return (
    <>
      <Sheet open={open} onClose={() => offer && decline(offer)} title={offer ? `New order ${offer.number}` : ''}>
        {offer && (
          <OfferBody
            key={offer.id}
            offer={offer}
            accepting={accept.isPending}
            onAccept={() => accept.mutate(offer)}
            onDecline={() => decline(offer)}
            onExpire={() => expire(offer)}
          />
        )}
        {accept.isError && accept.variables?.id === offer?.id && (
          <ErrorBanner message="Could not accept the order. Try again." className="mt-4" />
        )}
      </Sheet>
      {!open && status && (
        <StatusMessage tone="warning" className="mb-4">
          {status}
        </StatusMessage>
      )}
    </>
  )
}
