import { prisma } from "../lib/prisma"

async function main() {
  console.log("Seeding local database...")

  // Delete existing records to avoid conflicts
  await prisma.consentRecord.deleteMany({})
  await prisma.communicationLog.deleteMany({})
  await prisma.conversation.deleteMany({})
  await prisma.booking.deleteMany({})
  await prisma.table.deleteMany({})
  await prisma.zone.deleteMany({})
  await prisma.tableType.deleteMany({})
  await prisma.schedule.deleteMany({})
  await prisma.branch.deleteMany({})
  await prisma.apiKey.deleteMany({})
  await prisma.webhook.deleteMany({})
  await prisma.paymentSettings.deleteMany({})
  await prisma.staffMember.deleteMany({})
  await prisma.user.deleteMany({})
  await prisma.restaurant.deleteMany({})
  await prisma.customer.deleteMany({})

  // Create restaurant
  const restaurant = await prisma.restaurant.create({
    data: {
      name: "Le Bistrot Gourmet",
      slug: "bistrot-gourmet",
      type: "restaurante",
      status: "ACTIVE",
      timezone: "America/Bogota",
      plan: "PRO",
      primaryColor: "#dc2626", // Red-600
      secondaryColor: "#171717",
    },
  })
  console.log("Created Restaurant:", restaurant.name)

  // Create user mapped to our mock Clerk user ID
  const user = await prisma.user.create({
    data: {
      clerkUserId: "user_2P9Jz2kGzYw1t4Xz5y7w1t8x3y9",
      email: "admin@iagenda.com",
      name: "Administrador iAgenda",
      role: "OWNER",
      restaurantId: restaurant.id,
    },
  })
  console.log("Created User:", user.email)

  // Create branch
  const branch = await prisma.branch.create({
    data: {
      restaurantId: restaurant.id,
      name: "Sede Principal Chico",
      address: "Calle 93 # 12-45, Bogotá",
      phone: "+573001234567",
      latitude: 4.6768,
      longitude: -74.0483,
    },
  })
  console.log("Created Branch:", branch.name)

  // Create branch schedules (Monday to Sunday)
  for (let i = 0; i < 7; i++) {
    await prisma.schedule.create({
      data: {
        branchId: branch.id,
        dayOfWeek: i,
        openTime: "12:00",
        closeTime: "23:00",
        isClosed: false,
      },
    })
  }

  // Create table types
  const ttStandard = await prisma.tableType.create({
    data: {
      branchId: branch.id,
      name: "Mesa Estándar",
      minCapacity: 2,
      maxCapacity: 4,
      quantity: 8,
    },
  })

  const ttVIP = await prisma.tableType.create({
    data: {
      branchId: branch.id,
      name: "Zona VIP / Sofás",
      minCapacity: 4,
      maxCapacity: 8,
      quantity: 3,
    },
  })

  // Create zones
  const zoneSalon = await prisma.zone.create({
    data: {
      branchId: branch.id,
      name: "Salón Principal",
      width: 800,
      height: 600,
    },
  })

  const zoneTerraza = await prisma.zone.create({
    data: {
      branchId: branch.id,
      name: "Terraza Exterior",
      width: 600,
      height: 400,
    },
  })

  // Create tables in Salón Principal
  const tables = []
  const tableData = [
    { number: "1", capacity: 4, x: 100, y: 100, shape: "SQUARE", zoneId: zoneSalon.id, tableTypeId: ttStandard.id },
    { number: "2", capacity: 4, x: 250, y: 100, shape: "ROUND", zoneId: zoneSalon.id, tableTypeId: ttStandard.id },
    { number: "3", capacity: 2, x: 400, y: 100, shape: "SQUARE", zoneId: zoneSalon.id, tableTypeId: ttStandard.id },
    { number: "VIP 1", capacity: 6, x: 150, y: 300, shape: "RECTANGLE", zoneId: zoneSalon.id, tableTypeId: ttVIP.id },
    { number: "VIP 2", capacity: 8, x: 400, y: 300, shape: "RECTANGLE", zoneId: zoneSalon.id, tableTypeId: ttVIP.id },
    { number: "10", capacity: 4, x: 100, y: 100, shape: "ROUND", zoneId: zoneTerraza.id, tableTypeId: ttStandard.id },
    { number: "11", capacity: 2, x: 250, y: 150, shape: "SQUARE", zoneId: zoneTerraza.id, tableTypeId: ttStandard.id },
  ]

  for (const t of tableData) {
    const table = await prisma.table.create({
      data: t,
    })
    tables.push(table)
  }
  console.log(`Created ${tables.length} Tables`)

  // Create customers
  const customers = [
    { name: "Juan Pérez", email: "juan.perez@email.com", phone: "+573105551234", notes: "Prefiere mesa cerca a la ventana. Alérgico al maní." },
    { name: "Carolina Gómez", email: "caro.gomez@email.com", phone: "+573124445678", notes: "Cliente recurrente VIP. Prefiere vino tinto." },
    { name: "Andrés Mendoza", email: "andres.m@email.com", phone: "+573153339012", notes: "Suele celebrar cumpleaños aquí." },
  ]

  const seededCustomers = []
  for (const c of customers) {
    const customer = await prisma.customer.create({
      data: c,
    })
    seededCustomers.push(customer)
  }
  console.log(`Created ${seededCustomers.length} Customers`)

  // Create today's bookings
  const today = new Date()
  today.setHours(19, 0, 0, 0) // 7:00 PM today

  const booking1 = await prisma.booking.create({
    data: {
      branchId: branch.id,
      tableTypeId: ttStandard.id,
      customerId: seededCustomers[0].id,
      dateTime: today,
      partySize: 4,
      duration: 120,
      specialRequests: "Aniversario de bodas.",
      source: "WEB",
      status: "CONFIRMED",
    },
  })

  // Assign physical table 1 to booking 1
  await prisma.booking.update({
    where: { id: booking1.id },
    data: {
      tables: {
        connect: { id: tables[0].id },
      },
    },
  })

  const booking2 = await prisma.booking.create({
    data: {
      branchId: branch.id,
      tableTypeId: ttVIP.id,
      customerId: seededCustomers[1].id,
      dateTime: new Date(today.getTime() + 30 * 60 * 1000), // 7:30 PM today
      partySize: 6,
      duration: 150,
      specialRequests: "Requiere champaña de bienvenida.",
      source: "WHATSAPP",
      status: "CHECKED_IN",
    },
  })

  // Assign physical table VIP 1 to booking 2
  await prisma.booking.update({
    where: { id: booking2.id },
    data: {
      tables: {
        connect: { id: tables[3].id },
      },
    },
  })

  console.log("Seeding complete! Local database populated.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
