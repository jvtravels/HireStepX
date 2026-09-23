/* HireStepX — Design System / Forms, Extended
   Select, Native Select, Radio Group, Toggle, Toggle Group, Slider,
   Command + Combobox, Input OTP, Input Group, Field, Item, Kbd, Calendar
   + Date Picker. All real Radix/base-ui/vendor primitives, wired to actual
   state in this storyboard so they behave, not just render. */
import React from "react";
import "../../../public/fonts/af-sobremesa.css";
import { shadcnTheme } from "./_tokens";
import { SectionHead, Footer, PageShell, PageHeader } from "./_atoms";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { NativeSelect } from "@/components/ui/native-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Slider } from "@/components/ui/slider";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Combobox, ComboboxInput, ComboboxContent, ComboboxList, ComboboxItem, ComboboxEmpty } from "@/components/ui/combobox";
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item";
import { Kbd } from "@/components/ui/kbd";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bold, Italic, Underline, Building2, CalendarIcon } from "lucide-react";

/* No real DatePicker primitive exists in src/components/ui — only Calendar.
   A compact date field is a composition of real Popover + Button + Calendar,
   not a new library component. */
function DatePicker({
  value,
  onChange,
}: {
  value?: Date;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-56 justify-start font-normal">
          <CalendarIcon className="size-4" />
          {value ? value.toLocaleDateString() : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={value} onSelect={onChange} />
      </PopoverContent>
    </Popover>
  );
}

export default function DesignSystemFormsExtra() {
  const [otp, setOtp] = React.useState("");
  const [date, setDate] = React.useState<Date | undefined>();
  const [company, setCompany] = React.useState<string | null>(null);
  const [round, setRound] = React.useState("behavioral");

  return (
    <PageShell>
      <PageHeader
        title="Forms, extended."
        description="Select, Radio Group, Toggle Group, Slider, Command/Combobox, OTP, Field, Item, Kbd, Calendar & Date Picker — the rest of the form vocabulary beyond Input/Textarea/Checkbox."
      />
      <div style={shadcnTheme}>
        <section style={{ marginBottom: 48 }}>
          <SectionHead num="01" title="Select & Native Select" desc="Radix-portal listbox for most forms; native <select> for portal-hostile contexts." />
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Select defaultValue="pm">
              <SelectTrigger className="w-56"><SelectValue placeholder="Target role" /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Roles</SelectLabel>
                  <SelectItem value="pm">Product Manager</SelectItem>
                  <SelectItem value="swe">Software Engineer</SelectItem>
                  <SelectItem value="analyst">Business Analyst</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <NativeSelect className="w-56" defaultValue="mid">
              <option value="entry">Entry level</option>
              <option value="mid">Mid level</option>
              <option value="senior">Senior</option>
            </NativeSelect>
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="02" title="Radio Group & Toggle Group" desc="Single-select controls: dots for a form field, segmented buttons for a compact filter." />
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            <RadioGroup value={round} onValueChange={setRound} className="flex flex-col gap-2">
              {["behavioral", "technical", "negotiation"].map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm capitalize">
                  <RadioGroupItem value={r} /> {r}
                </label>
              ))}
            </RadioGroup>
            <div className="flex flex-col gap-2">
              <Label>Text formatting (demo)</Label>
              <ToggleGroup type="multiple">
                <ToggleGroupItem value="bold" aria-label="Bold"><Bold className="size-4" /></ToggleGroupItem>
                <ToggleGroupItem value="italic" aria-label="Italic"><Italic className="size-4" /></ToggleGroupItem>
                <ToggleGroupItem value="underline" aria-label="Underline"><Underline className="size-4" /></ToggleGroupItem>
              </ToggleGroup>
              <Toggle aria-label="Toggle single">Single toggle</Toggle>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="03" title="Slider" desc="Continuous value — e.g. answer-length target in seconds." />
          <div style={{ maxWidth: 320 }}>
            <Slider defaultValue={[60]} max={180} step={5} />
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="04" title="Command & Combobox" desc="Command is the searchable-list primitive (cmdk); Combobox is the base-ui compound single-select field." />
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div className="w-72 rounded-lg border border-border">
              <Command>
                <CommandInput placeholder="Search companies…" />
                <CommandList>
                  <CommandEmpty>No match found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem>Google</CommandItem>
                    <CommandItem>Flipkart</CommandItem>
                    <CommandItem>Zomato</CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>
            <div className="w-64">
              <Label className="mb-1.5 block">Company</Label>
              <Combobox value={company} onValueChange={setCompany} items={["google", "flipkart", "zomato", "swiggy"]}>
                <ComboboxInput placeholder="Select company" />
                <ComboboxContent>
                  <ComboboxEmpty>No match found.</ComboboxEmpty>
                  <ComboboxList>
                    <ComboboxItem value="google">Google</ComboboxItem>
                    <ComboboxItem value="flipkart">Flipkart</ComboboxItem>
                    <ComboboxItem value="zomato">Zomato</ComboboxItem>
                    <ComboboxItem value="swiggy">Swiggy</ComboboxItem>
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="05" title="Input OTP" desc="6-digit email/phone verification code." />
          <InputOTP maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator />
            <InputOTPGroup>
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="06" title="Input Group & Field" desc="Adorned input, and the label + control + description/error composition." />
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <InputGroup className="w-56">
              <InputGroupAddon>₹</InputGroupAddon>
              <InputGroupInput placeholder="Expected salary" />
            </InputGroup>
            <Field className="w-64">
              <FieldLabel htmlFor="target-co">Target company</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Building2 className="size-4 text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput id="target-co" placeholder="e.g. Razorpay" />
              </InputGroup>
              <FieldDescription>Used to tailor interview questions.</FieldDescription>
            </Field>
            <Field className="w-64">
              <FieldLabel htmlFor="target-co-err">Email</FieldLabel>
              <InputGroupInput id="target-co-err" defaultValue="not-an-email" />
              <FieldError>Enter a valid email address.</FieldError>
            </Field>
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <SectionHead num="07" title="Item & Kbd" desc="Generic list row (question bank, settings) and a keyboard-shortcut chip." />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
            <Item>
              <ItemMedia><Building2 /></ItemMedia>
              <ItemContent>
                <ItemTitle>Tell me about a time you managed conflict.</ItemTitle>
                <ItemDescription>Behavioral · STAR</ItemDescription>
              </ItemContent>
              <ItemActions><Kbd>⌘</Kbd><Kbd>K</Kbd></ItemActions>
            </Item>
          </div>
        </section>

        <section>
          <SectionHead num="08" title="Calendar & Date Picker" desc="react-day-picker underneath. No real Date Picker primitive exists — this is a composition of Popover + Button + Calendar." />
          <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div className="rounded-lg border border-border w-fit">
              <Calendar mode="single" selected={date} onSelect={setDate} />
            </div>
            <div>
              <Label className="mb-1.5 block">Practice reminder date</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
          </div>
        </section>
      </div>
      <Footer section="Forms · Extended" tagline="All controlled — click, type, drag." />
    </PageShell>
  );
}
