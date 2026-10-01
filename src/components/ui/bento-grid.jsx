import { ReactNode } from "react";

// 简单的工具函数来合并CSS类名
const cn = (...classes) => classes.filter(Boolean).join(' ');

const BentoGrid = ({
    children,
    className,
}) => {
    return (
        <div
            className={cn(
                // 移动端卡片高度自适应，桌面端使用固定行高形成 bento 布局
                "grid w-full auto-rows-auto grid-cols-3 gap-3 lg:auto-rows-[22rem] lg:gap-4",
                className,
            )}
        >
            {children}
        </div>
    );
};

const BentoCard = ({
    name,
    className,
    background,
    Icon,
    description,
    href,
    onClick,
    cta,
    comment,
    ctaClassName = "",
}) => (
    <div
        key={name}
        className={cn(
            "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-2xl",
            // light styles
            "bg-white [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
            // dark styles
            "transform-gpu dark:bg-black dark:[border:1px_solid_rgba(255,255,255,.1)] dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset]",
            // 添加点击样式
            onClick ? "cursor-pointer active:scale-[0.99] transition-transform" : "",
            className,
        )}
        onClick={onClick}
    >
        <div>{background}</div>
        <div>{comment}</div>
        <div className="pointer-events-none z-10 flex transform-gpu flex-col gap-1 p-4 transition-all duration-300 lg:p-6 lg:group-hover:-translate-y-10">
            <Icon className="h-9 w-9 origin-left transform-gpu text-neutral-700 transition-all duration-300 ease-in-out lg:h-12 lg:w-12 lg:group-hover:scale-75" />
            <h3 className="text-base font-semibold text-neutral-700 dark:text-neutral-300 lg:text-xl">
                {name}
            </h3>
            <p className="text-sm text-neutral-400 lg:max-w-lg">{description}</p>
        </div>

        <div
            className={cn(
                // 移动端常驻显示 CTA，桌面端悬浮时滑入
                "pointer-events-none static flex w-full translate-y-0 flex-row items-center p-4 pt-0 opacity-100 transition-all duration-300 lg:absolute lg:bottom-0 lg:translate-y-10 lg:p-4 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100",
            )}
        >
            {onClick ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick?.();
                    }}
                    className={cn(
                        "pointer-events-auto inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 lg:h-9 lg:rounded-md lg:px-3",
                        ctaClassName
                    )}
                >
                    {cta}
                    {cta && (
                        <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    )}
                </button>
            ) : (
                <a
                    href={href}
                    className={cn(
                        "pointer-events-auto inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-10 px-4 lg:h-9 lg:rounded-md lg:px-3",
                        ctaClassName
                    )}
                >
                    {cta}
                    {cta && (
                        <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                    )}
                </a>
            )}
        </div>
        <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/[.03] group-hover:dark:bg-neutral-800/10" />
    </div>
);

export { BentoCard, BentoGrid };