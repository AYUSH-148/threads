'use client'
import { usePathname } from 'next/navigation'
import React from 'react'
import { sidebarLinks } from "@/constants/index"
import Link from 'next/link'
import Image from 'next/image'
const BottomBar = () => {
    const pathname = usePathname();
    return (
        <section className='bottombar'>
            <div className='flex items-center justify-between gap-3 xs:gap-5'>
                {sidebarLinks.map((link) => {
                    const isActive = pathname.includes(link.route)
                    return (

                        <Link href={link.route} key={link.label} className={`${isActive && "bg-primary-500"} relative flex flex-col items-center gap-2 rounded-lg p-2 sm:flex-1 sm:px-2 sm:py-2.5`}>

                            <Image 
                                src={link.imgURL} 
                                alt={link.label} 
                                width={16} 
                                height={16} className="object-contain" />

                            <p className='text-subtle-medium text-light-1 max-sm:hidden'>
                                {link.label.split(/\s+/)[0]}
                            </p>
                            
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}

export default BottomBar
