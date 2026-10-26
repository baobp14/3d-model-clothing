import AddressBook from '../components/AddressBook'
import { useLang } from '../i18n'

export default function Addresses() {
  const { lang } = useLang()
  return <main className="shop-shell"><title>{`${lang === "vi" ? "Sổ địa chỉ của tôi" : "My address book"} – N&B`}</title><h1 className="font-display text-title">{lang === "vi" ? "Sổ địa chỉ của tôi" : "My address book"}</h1><div className="mt-8 max-w-2xl"><AddressBook /></div></main>
}
