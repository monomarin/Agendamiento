import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export interface OnboardingRestaurantInfo {
  name: string
  slug: string
  nit: string
  type: string
  address: string
  phone: string
  email: string
  description: string
  city: string
  logoUrl?: string
  bannerUrl?: string
  primaryColor: string
  secondaryColor: string
  timezone: string
}

export interface OnboardingSchedule {
  dayOfWeek: number
  openTime: string
  closeTime: string
  isClosed: boolean
}

export interface OnboardingTableType {
  id?: string // Client side temp id
  name: string
  minCapacity: number
  maxCapacity: number
  quantity: number
}

export interface OnboardingPaymentSettings {
  stripeEnabled: boolean
  stripePublishableKey?: string
  stripeSecretKey?: string
  wompiEnabled: boolean
  wompiPublicKey?: string
  wompiPrivateKey?: string
  requireDeposit: boolean
  depositAmount: number
  depositType: "FIXED" | "PERCENTAGE"
  currency: string
  cancellationPolicyDays: number
}

export interface OnboardingWhatsappConfig {
  agentEnabled: boolean
  whatsappNumber?: string
  customInstructions?: string
}

interface OnboardingState {
  currentStep: number
  restaurantInfo: OnboardingRestaurantInfo
  schedules: OnboardingSchedule[]
  tableTypes: OnboardingTableType[]
  paymentSettings: OnboardingPaymentSettings
  whatsappConfig: OnboardingWhatsappConfig
  
  // Actions
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  updateRestaurantInfo: (info: Partial<OnboardingRestaurantInfo>) => void
  updateSchedules: (schedules: OnboardingSchedule[]) => void
  updateTableTypes: (tableTypes: OnboardingTableType[]) => void
  updatePaymentSettings: (settings: Partial<OnboardingPaymentSettings>) => void
  updateWhatsappConfig: (config: Partial<OnboardingWhatsappConfig>) => void
  reset: () => void
}

const defaultSchedules: OnboardingSchedule[] = Array.from({ length: 7 }, (_, i) => ({
  dayOfWeek: i,
  openTime: "12:00",
  closeTime: "22:00",
  isClosed: i === 1, // Default closed on Mondays (1)
}))

const defaultTableTypes: OnboardingTableType[] = [
  { name: "Mesa Estándar", minCapacity: 2, maxCapacity: 4, quantity: 5 },
  { name: "Mesa VIP / Especial", minCapacity: 2, maxCapacity: 6, quantity: 2 },
]

const initialRestaurantInfo: OnboardingRestaurantInfo = {
  name: "",
  slug: "",
  nit: "",
  type: "restaurante",
  address: "",
  phone: "",
  email: "",
  description: "",
  city: "",
  primaryColor: "#dc2626", // Red-600
  secondaryColor: "#171717", // Neutral-900
  timezone: "America/Bogota",
}

const initialPaymentSettings: OnboardingPaymentSettings = {
  stripeEnabled: false,
  wompiEnabled: false,
  requireDeposit: false,
  depositAmount: 0,
  depositType: "FIXED",
  currency: "COP",
  cancellationPolicyDays: 1,
}

const initialWhatsappConfig: OnboardingWhatsappConfig = {
  agentEnabled: false,
  whatsappNumber: "",
  customInstructions: "Atiende con amabilidad y ayuda a los clientes a reservar.",
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      currentStep: 1,
      restaurantInfo: initialRestaurantInfo,
      schedules: defaultSchedules,
      tableTypes: defaultTableTypes,
      paymentSettings: initialPaymentSettings,
      whatsappConfig: initialWhatsappConfig,

      setStep: (step) => set({ currentStep: step }),
      nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 5) })),
      prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),
      
      updateRestaurantInfo: (info) =>
        set((state) => ({
          restaurantInfo: { ...state.restaurantInfo, ...info },
        })),
        
      updateSchedules: (schedules) => set({ schedules }),
      updateTableTypes: (tableTypes) => set({ tableTypes }),
      
      updatePaymentSettings: (settings) =>
        set((state) => ({
          paymentSettings: { ...state.paymentSettings, ...settings },
        })),
        
      updateWhatsappConfig: (config) =>
        set((state) => ({
          whatsappConfig: { ...state.whatsappConfig, ...config },
        })),
        
      reset: () =>
        set({
          currentStep: 1,
          restaurantInfo: initialRestaurantInfo,
          schedules: defaultSchedules,
          tableTypes: defaultTableTypes,
          paymentSettings: initialPaymentSettings,
          whatsappConfig: initialWhatsappConfig,
        }),
    }),
    {
      name: "iagenda-onboarding-draft",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
