import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface CustomerData {
  name: string
  email: string
  phone: string
  hasConsent: boolean
}

export interface PaymentData {
  token: string
  gateway: "STRIPE" | "WOMPI"
  amount: number
}

interface BookingState {
  // Booking state
  currentStep: number
  selectedBranchId: string | null
  partySize: number
  eventType: string
  specialRequests: string
  selectedDate: string | null // YYYY-MM-DD
  selectedTime: string | null // HH:MM
  customer: CustomerData | null
  payment: PaymentData | null
  bookingId: string | null
  confirmationCode: string | null
  
  // Actions
  setStep: (step: number) => void
  setSelectedBranchId: (branchId: string | null) => void
  setPartySize: (size: number) => void
  setEventType: (type: string) => void
  setSpecialRequests: (requests: string) => void
  setSelectedDate: (date: string | null) => void
  setSelectedTime: (time: string | null) => void
  setCustomer: (customer: CustomerData | null) => void
  setPayment: (payment: PaymentData | null) => void
  setBookingId: (id: string | null) => void
  setConfirmationCode: (code: string | null) => void
  reset: () => void
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set) => ({
      currentStep: 1,
      selectedBranchId: null,
      partySize: 2,
      eventType: "Cena casual",
      specialRequests: "",
      selectedDate: null,
      selectedTime: null,
      customer: null,
      payment: null,
      bookingId: null,
      confirmationCode: null,

      setStep: (step) => set({ currentStep: step }),
      setSelectedBranchId: (branchId) => set({ selectedBranchId: branchId }),
      setPartySize: (size) => set({ partySize: size }),
      setEventType: (type) => set({ eventType: type }),
      setSpecialRequests: (requests) => set({ specialRequests: requests }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setSelectedTime: (time) => set({ selectedTime: time }),
      setCustomer: (customer) => set({ customer }),
      setPayment: (payment) => set({ payment }),
      setBookingId: (id) => set({ bookingId: id }),
      setConfirmationCode: (code) => set({ confirmationCode: code }),
      
      reset: () => set({
        currentStep: 1,
        selectedBranchId: null,
        partySize: 2,
        eventType: "Cena casual",
        specialRequests: "",
        selectedDate: null,
        selectedTime: null,
        customer: null,
        payment: null,
        bookingId: null,
        confirmationCode: null,
      })
    }),
    {
      name: "iagenda-booking-state",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
