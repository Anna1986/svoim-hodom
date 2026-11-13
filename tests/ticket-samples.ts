import { parseTicket } from '../src/ticketParse'
const today = new Date(2026, 10, 13)
const S: Record<string,string> = {
aeroflot: `МАРШРУТНАЯ КВИТАНЦИЯ ЭЛЕКТРОННОГО БИЛЕТА
Дата оформления: 01.11.2026
Пассажир: IVANOVA ANNA
Номер билета: 555 2412345678
Код бронирования: KXQ7ZT
Рейс Вылет Прилёт
SU 1234 Самара (KUF) 24 ноя 2026 08:05 Москва (SVO) 24 ноя 2026 08:30
Терминал B Багаж 1PC Место 12A`,
pobeda_en: `ITINERARY RECEIPT
Booking reference: LM8K2P
Flight DP 6512 Date of issue 05NOV26
From: KUF Samara To: VKO Moscow
Departure 29NOV 21:40 Arrival 29NOV 22:15`,
rzd: `Электронный билет РЖД
Номер заказа: 74123456789012
Поезд 010Е
МОСКВА КАЗАН — САМАРА
Отправление 24.11.2026 в 18:20 (МСК)
Прибытие 25.11 07:50
Вагон 05 Место 012 Купе
Дата рождения 12.03.1986`,
hotel: `Подтверждение бронирования
Номер брони: 4829-1175
Отель Арбат Хаус
Адрес: Москва, ул. Арбат, 20
Заезд: 24 ноября 2026, с 14:00
Выезд: 29 ноября 2026, до 12:00
Тел: +7 495 123-45-67
2 ночи`,
booking_en: `Booking.com confirmation
Confirmation number: 3817.552.901
Hotel Moscow Centre
Address: Tverskaya 3, Moscow
Check-in Tue, Nov 24, 2026 from 15:00
Check-out Sun, Nov 29, 2026 until 12:00`,
theatre: `Электронный билет
Мероприятие: Щелкунчик
Большой театр, Историческая сцена
Адрес: Театральная площадь, 1
Дата: 25.11.2026 19:00
Партер Ряд 7 Место 14
Номер заказа: 99812345`,
}
for (const [k,v] of Object.entries(S)) console.log(k, JSON.stringify(parseTicket(v, today), null, 0))
console.log(parseTicket(`Поезд 102Й\nСАМАРА — МОСКВА КАЗАНСКАЯ ПН\nОтправление 25.11.2026 18:41\nПрибытие 26.11.2026 10:40\nМесто 031`, today))
