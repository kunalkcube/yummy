export interface StreamingProvider {
  id: number;
  name: string;
  logo_path: string;
  color: string;
}

export const STREAMING_PROVIDERS: StreamingProvider[] = [
  {
    id: 8, // Netflix
    name: 'Netflix',
    logo_path: '/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg',
    color: '#E50914',
  },
  {
    id: 119, // Amazon Prime Video (India - IN priority: 1)
    name: 'Prime',
    logo_path: '/emthp39XA2YScoYL1p0sdbAH2WA.jpg',
    color: '#00A8E1',
  },
  {
    id: 122, // Hotstar/Disney+ (India - IN priority: 2)
    name: 'Disney+ Hotstar',
    logo_path: '/7Fl8ylPDclt3ZYgNbW2t7rbZE9I.jpg',
    color: '#1F80E0',
  },
  {
    id: 283, // Crunchyroll
    name: 'Crunchyroll',
    logo_path: '/8Gt1iClBlzTeQs8WQm8UrCoIxnQ.jpg',
    color: '#F47521',
  },
  {
    id: 350, // Apple TV+
    name: 'Apple TV+',
    logo_path: '/6uhKBfmtzFqOcLousHwZuzcrScK.jpg',
    color: '#000000',
  },
  {
    id: 2, // Apple TV
    name: 'Apple TV',
    logo_path: '/peURlLlr8jggOwK53fJ5wdQl05y.jpg',
    color: '#000000',
  },
  {
    id: 220, // Jio Cinema (IN priority: 4)
    name: 'Jio Cinema',
    logo_path: '/jRpQbuHbGR0MzSIBxJjxZxpXhqC.jpg',
    color: '#8B14E7',
  },
  {
    id: 232, // Zee5 (IN priority: 5)
    name: 'Zee5',
    logo_path: '/ajbCmwvZ8HiePHZaOVEgm9MzyuA.jpg',
    color: '#9B26AF',
  },
  {
    id: 237, // Sony Liv (IN priority: 12)
    name: 'Sony Liv',
    logo_path: '/odTur9CmVtzsRUAZ9910tPM4XwL.jpg',
    color: '#0F6FFF',
  },
  {
    id: 510, // Discovery Plus (IN priority: 28)
    name: 'Discovery Plus',
    logo_path: '/wYRiUqIgWcfUvO6OPcXuUNd4tc2.jpg',
    color: '#0066CC',
  },
  {
    id: 502, // Tata Play (IN priority: 27)
    name: 'Tata Play',
    logo_path: '/qLR6qzB1IcANZUqMEkLf6Sh8Y8s.jpg',
    color: '#0052CC',
  },
  {
    id: 515, // MX Player (IN priority: 32)
    name: 'MX Player',
    logo_path: '/dH4BZucVyb5lW97TEbZ7RTAugjg.jpg',
    color: '#0D6EFD',
  },
  {
    id: 532, // aha (IN priority: 34)
    name: 'aha',
    logo_path: '/m3NWxxR23l1w1e156fyTuw931gx.jpg',
    color: '#FFB800',
  },
  {
    id: 561, // Lionsgate Play (IN priority: 41)
    name: 'Lionsgate Play',
    logo_path: '/vrFpju3t7kplDbFsN5GLJpG0obj.jpg',
    color: '#FF6B00',
  },
  {
    id: 1898, // Amazon miniTV (IN priority: 58)
    name: 'Amazon miniTV',
    logo_path: '/tcRSEeMnRxtKHqg7kqF8z5SvUpF.jpg',
    color: '#00A8E1',
  },
];
