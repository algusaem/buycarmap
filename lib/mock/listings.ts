export interface CarListing {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  price: number;
  mileage: number;
  year: number;
  fuel: string;
  location: string;
  source: string;
}

export const MOCK_LISTINGS: CarListing[] = [
  {
    id: "1",
    image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
    title: "2019 Volkswagen Golf",
    subtitle: "1.6 TDI Business Edition",
    price: 14500,
    mileage: 45230,
    year: 2019,
    fuel: "Diesel",
    location: "Madrid",
    source: "Wallapop",
  },
  {
    id: "2",
    image: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&q=80",
    title: "2020 Seat León",
    subtitle: "1.5 TSI FR",
    price: 18900,
    mileage: 32100,
    year: 2020,
    fuel: "Gasolina",
    location: "Barcelona",
    source: "Coches.net",
  },
  {
    id: "3",
    image: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80",
    title: "2018 BMW Serie 3",
    subtitle: "320d xDrive",
    price: 24500,
    mileage: 67800,
    year: 2018,
    fuel: "Diesel",
    location: "Valencia",
    source: "Milanuncios",
  },
  {
    id: "4",
    image: "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=800&q=80",
    title: "2021 Audi A4",
    subtitle: "35 TFSI S line",
    price: 32000,
    mileage: 21500,
    year: 2021,
    fuel: "Gasolina",
    location: "Sevilla",
    source: "AutoScout24",
  },
  {
    id: "5",
    image: "https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?w=800&q=80",
    title: "2017 Mercedes Clase C",
    subtitle: "220d AMG Line",
    price: 22800,
    mileage: 89000,
    year: 2017,
    fuel: "Diesel",
    location: "Málaga",
    source: "Wallapop",
  },
  {
    id: "6",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80",
    title: "2020 Toyota Corolla",
    subtitle: "Hybrid Active",
    price: 19500,
    mileage: 41200,
    year: 2020,
    fuel: "Híbrido",
    location: "Bilbao",
    source: "Coches.net",
  },
];
