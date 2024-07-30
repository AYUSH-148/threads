"use client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react";
import Image from "next/image"
import { Input } from "./ui/input";
interface SearchProps {
    routeType: string
}

const SearchBar = ({ routeType }: SearchProps) => {
    const router = useRouter();
    const [search, setSearch] = useState("");

    useEffect(() => {
        const debounceFxn = setTimeout(() => {
            if (search) {
                router.push(`/${routeType}?q=` + search)
            } else {
                router.push(`/${routeType}`)
            }
        }, 300)
        return () => clearTimeout(debounceFxn);
    })
    return (
        <div className='searchbar'>
            <Image
                src='/assets/search-gray.svg'
                alt='search'
                width={24}
                height={24}
                className='object-contain'
            />
            <Input
                id='text'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`${routeType !== "/search" ? "Search communities" : "Search creators"
                    }`}
                className='no-focus searchbar_input'
            />
        </div>
    )
}

export default SearchBar
