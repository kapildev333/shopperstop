import { useRef, useState } from 'react'
import { View } from 'react-native'
import { cancelOrder, type Order } from './orders'
import { Button } from './ui/button'
import { Chip } from './ui/chip'
import { Sheet as Dialog } from './ui/sheet'
import { Text } from './ui/text'
import { fontFamily } from './ui/tokens'

// Fallback: Dialog (src/ui/dialog.tsx, L2) is not on this branch yet, so the Sheet stands in. When it lands, the swap is this
// one import: `import { Dialog } from './ui/dialog'`. Same props (`open`, `title`, `onClose`, children).

const reasons = ['Ordered by mistake', 'Want to change items', 'Delivery is taking too long', 'Other']

export function CancelOrderDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState<string>()
  const [refusal, setRefusal] = useState<string>()
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  // Keep order and an answered cancel both leave the dialog fresh for its next opening.
  function close() {
    setReason(undefined)
    setRefusal(undefined)
    onClose()
  }

  // One send while pending: the ref guards a second press before the disabled state renders.
  async function confirm() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    const result = await cancelOrder(order.id, reason)
    inFlight.current = false
    setBusy(false)
    if (result.order) close()
    else setRefusal(result.error?.code === 'conflict' ? 'This order can no longer be cancelled.' : 'Could not cancel the order. Try again.')
  }

  return (
    <Dialog open={open} title="Cancel this order?" onClose={close}>
      <View style={{ gap: 16, paddingTop: 8 }}>
        <Text tone="inkMuted">{`Order ${order.number} hasn't been packed yet, so you can still cancel it. Nothing has been charged.`}</Text>
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: fontFamily(600) }}>
            Reason (optional)
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {reasons.map((label) => (
              <Chip key={label} selected={reason === label} onPress={() => setReason(reason === label ? undefined : label)}>
                {label}
              </Chip>
            ))}
          </View>
        </View>
        {refusal ? (
          <Text tone="danger" accessibilityRole="alert">
            {refusal}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Button variant="secondary" size="lg" onPress={close}>
              Keep order
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button variant="danger" size="lg" loading={busy} onPress={() => void confirm()}>
              Cancel order
            </Button>
          </View>
        </View>
      </View>
    </Dialog>
  )
}
