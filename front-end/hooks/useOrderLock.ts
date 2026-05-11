"use client"

type OrderLockState = {
  isLocked: boolean
  message: string
}

const ORDERS_ALWAYS_OPEN_STATE: OrderLockState = {
  isLocked: false,
  message: "",
}

export const isOrderLockedAt = () => {
  return false
}

export const getOrderLockState = (): OrderLockState => ORDERS_ALWAYS_OPEN_STATE

export function useOrderLock() {
  return ORDERS_ALWAYS_OPEN_STATE
}
