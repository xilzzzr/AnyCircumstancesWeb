import { useEffect, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Clock, HelpCircle, Shield, Upload, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { GUIDE_LANGUAGE_KEY, guideLanguages, initialGuideLanguage, isGuideLanguage, quickGuideContent } from '@/data/quickGuideContent';
import { cn } from '@/lib/utils';

const pages = [
  { icon: Shield, route: '/app/upload' },
  { icon: Upload, route: '/app/upload' },
  { icon: Users, route: '/app/emergency-contacts' },
  { icon: CheckCircle2, route: '/app/check-in' },
  { icon: Clock, route: '/app/verification' },
];
const carouselOptions = { loop: false, align: 'start' as const };

type QuickGuideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerRef?: RefObject<HTMLButtonElement>;
};

export function QuickGuideDialog({ open, onOpenChange, triggerRef }: QuickGuideDialogProps) {
  const [language, setLanguage] = useState(initialGuideLanguage);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const content = quickGuideContent[language];
  const pageCount = content.pageCount.replace('{current}', String(current + 1)).replace('{total}', String(pages.length));

  useEffect(() => {
    if (!open || !api) return;
    const update = () => setCurrent(api.selectedScrollSnap());
    update();
    api.on('select', update);
    api.on('reInit', update);
    return () => { api.off('select', update); api.off('reInit', update); };
  }, [open, api]);

  useEffect(() => {
    const element = carouselRef.current;
    if (!open || !element || !api) return;
    let distance = 0;
    let lastEvent = 0;
    let lastPage = 0;
    // Embla handles touch and mouse drag. Add horizontal trackpad gestures;
    // vertical wheel movement remains native scrolling within the page.
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      const now = Date.now();
      if (now - lastEvent > 160) distance = 0;
      lastEvent = now;
      distance += event.deltaX;
      if (Math.abs(distance) < 36 || now - lastPage < 450) return;
      if (distance > 0) api.scrollNext(); else api.scrollPrev();
      distance = 0;
      lastPage = now;
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [open, api]);

  useEffect(() => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && carouselRef.current?.contains(focused) && focused.closest('[aria-hidden="true"]')) {
      carouselRef.current.focus({ preventScroll: true });
    }
  }, [current]);

  function changeLanguage(value: string) {
    if (!isGuideLanguage(value)) return;
    setLanguage(value);
    try { localStorage.setItem(GUIDE_LANGUAGE_KEY, value); } catch { /* Optional preference only. */ }
  }

  function goTo(route: string) {
    onOpenChange(false);
    navigate(route);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      lang={language === 'zh' ? 'zh-Hans' : language}
      className="flex h-[min(760px,88dvh)] max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden rounded-2xl bg-card p-0 [&>button]:flex [&>button]:h-11 [&>button]:w-11 [&>button]:items-center [&>button]:justify-center [&>button]:right-2 [&>button]:top-2"
      onCloseAutoFocus={event => {
        if (triggerRef?.current) { event.preventDefault(); triggerRef.current.focus(); }
      }}
    >
      <DialogHeader className="max-h-[25dvh] shrink-0 overflow-y-auto overscroll-contain border-b border-border px-5 py-5 pr-14 text-left sm:px-7 sm:pr-16">
        <DialogTitle className="flex items-start gap-3 text-base leading-snug sm:text-lg">
          <HelpCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          {content.dialogTitle}
        </DialogTitle>
        <DialogDescription className="leading-relaxed">{content.dialogSubtitle}</DialogDescription>
      </DialogHeader>

      <Carousel ref={carouselRef} opts={carouselOptions} setApi={setApi} tabIndex={0}
        aria-label={content.dialogTitle}
        className="flex min-h-0 flex-1 flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&>div:first-child]:min-h-0 [&>div:first-child]:flex-1">
        <CarouselContent className="ml-0 h-full">
          {content.pages.map((page, index) => {
            const Icon = pages[index].icon;
            const warning = index === 3;
            return <CarouselItem key={index} aria-hidden={index !== current} aria-label={content.pageCount.replace('{current}', String(index + 1)).replace('{total}', '5')}
              className="h-full overflow-y-auto overscroll-contain break-words px-5 py-6 touch-pan-y sm:px-7">
              <div className="flex items-center gap-3 text-primary">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/60"><Icon aria-hidden="true" className="h-5 w-5" /></span>
                <p className="text-xs font-medium tracking-wider">{page.label}</p>
              </div>
              <h2 className="mt-5 text-2xl font-medium leading-tight tracking-tight sm:text-3xl">{page.headline}</h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{page.body}</p>
              <div className={cn('mt-5 flex items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed', warning ? 'border-warning/25 bg-warning/10' : 'border-border bg-muted/40')}>
                {warning && <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-warning" />}
                <p>{page.callout}</p>
              </div>
              <Button className="mt-6 h-auto min-h-11 w-full whitespace-normal py-3 sm:w-auto" tabIndex={index === current ? 0 : -1} onClick={() => goTo(pages[index].route)}>
                {page.cta}<ArrowRight aria-hidden="true" />
              </Button>
            </CarouselItem>;
          })}
        </CarouselContent>
        <div className="shrink-0 px-4 pb-3 pt-2 sm:px-7">
          <p role="status" aria-live="polite" aria-atomic="true" className="mb-1 text-center text-xs text-muted-foreground">{pageCount}</p>
          <div className="flex items-center justify-between gap-1">
            <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={current === 0} aria-label={content.previous} onClick={() => api?.scrollPrev()}><ArrowLeft aria-hidden="true" /></Button>
            <div className="flex min-w-0 max-w-[220px] flex-1 items-center">
              {pages.map((_, index) => <button key={index} type="button" className="flex h-11 min-w-0 max-w-11 flex-1 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={content.goToPage.replace('{page}', String(index + 1))} aria-current={index === current ? 'step' : undefined} onClick={() => api?.scrollTo(index)}>
                <span aria-hidden="true" className={cn('h-2 rounded-full transition-[width,background-color] motion-reduce:transition-none', index === current ? 'w-5 bg-primary' : 'w-2 bg-muted-foreground/40')} />
              </button>)}
            </div>
            <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={current === pages.length - 1} aria-label={content.next} onClick={() => api?.scrollNext()}><ArrowRight aria-hidden="true" /></Button>
          </div>
        </div>
      </Carousel>

      <footer className="max-h-[28dvh] shrink-0 overflow-y-auto overscroll-contain border-t border-border px-5 py-4 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="quick-guide-language" className="text-sm text-muted-foreground">{content.languageLabel}</label>
          <Select value={language} onValueChange={changeLanguage}>
            <SelectTrigger id="quick-guide-language" className="h-11 w-40 max-w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{guideLanguages.map(item => <SelectItem key={item.value} value={item.value}><span lang={item.value}>{item.label}</span></SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{content.languageNote}</p>
      </footer>
    </DialogContent>
  </Dialog>;
}
