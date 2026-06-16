import * as React from "react"

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function useUser() {
  return {
    isSignedIn: true,
    isLoaded: true,
    user: {
      id: "user_2P9Jz2kGzYw1t4Xz5y7w1t8x3y9", // a clerk-like dummy ID
      firstName: "Administrador",
      lastName: "iAgenda",
      imageUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face",
      emailAddresses: [{ emailAddress: "admin@iagenda.com" }],
    },
  }
}

export function UserButton() {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800">
      <img
        src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face"
        alt="Avatar"
        className="w-7 h-7 rounded-full border border-neutral-700"
      />
      <span className="text-xs text-neutral-300 font-medium">Admin</span>
    </div>
  )
}

export function SignInButton({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function SignUpButton({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

export function SignIn(props: any) {
  return (
    <div className="p-8 bg-neutral-950 border border-neutral-800 rounded-2xl max-w-sm w-full text-center space-y-4">
      <h2 className="text-xl font-bold text-white">Sign In Mock</h2>
      <p className="text-sm text-neutral-400">Acceso bypass activado para desarrollo.</p>
      <a href="/dashboard" className="block w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 font-medium text-sm transition-colors">
        Ir al Dashboard
      </a>
    </div>
  )
}

export function SignUp(props: any) {
  return (
    <div className="p-8 bg-neutral-950 border border-neutral-800 rounded-2xl max-w-sm w-full text-center space-y-4">
      <h2 className="text-xl font-bold text-white">Sign Up Mock</h2>
      <p className="text-sm text-neutral-400">Registro bypass activado para desarrollo.</p>
      <a href="/dashboard" className="block w-full py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 font-medium text-sm transition-colors">
        Registrarse e Ir al Dashboard
      </a>
    </div>
  )
}
