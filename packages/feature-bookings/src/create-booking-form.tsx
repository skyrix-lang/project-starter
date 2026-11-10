import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { getListBookingsQueryKey, useCreateBooking } from "@booking/api";
import { createBookingSchema } from "@booking/core";
import {
  Button,
  Card,
  Field,
  FieldError,
  FieldLabel,
  Input,
} from "@booking/ui";

type FormInput = z.input<typeof createBookingSchema>;
type FormOutput = z.output<typeof createBookingSchema>;

/**
 * Validates with the same schema as the BFF, so the browser and the server
 * agree on what a valid booking is. The server still checks: this is for speed.
 */
export function CreateBookingForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const create = useCreateBooking();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(createBookingSchema),

    defaultValues: { title: "", description: "", date: "", time: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    await create.mutateAsync({ data: values });
    await queryClient.invalidateQueries({
      queryKey: getListBookingsQueryKey(),
    });
    onDone();
  });

  const fieldError = (name: keyof FormInput) => errors[name]?.message;

  return (
    <Card>
      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="grid gap-4 sm:grid-cols-2"
      >
        <h2 className="text-lg font-semibold sm:col-span-2">New booking</h2>
        <Field invalid={!!errors.title} className="sm:col-span-2">
          <FieldLabel>Title</FieldLabel>
          <Input {...register("title")} />
          <FieldError match={!!errors.title}>Enter a title.</FieldError>
        </Field>
        <Field invalid={!!errors.description} className="sm:col-span-2">
          <FieldLabel>Description</FieldLabel>
          <Input {...register("description")} />
          <FieldError match={!!errors.description}>
            {fieldError("description")}
          </FieldError>
        </Field>
        <Field invalid={!!errors.date}>
          <FieldLabel>Date</FieldLabel>
          <Input type="date" {...register("date")} />
          <FieldError match={!!errors.date}>Enter a valid date.</FieldError>
        </Field>
        <Field invalid={!!errors.time}>
          <FieldLabel>Time</FieldLabel>
          <Input type="time" {...register("time")} />
          <FieldError match={!!errors.time}>
            Enter a time, like 09:30.
          </FieldError>
        </Field>
        <Field invalid={!!errors.duration}>
          <FieldLabel>Duration (minutes)</FieldLabel>
          <Input
            type="number"
            min={1}
            max={1440}
            {...register("duration", { valueAsNumber: true })}
          />
          <FieldError match={!!errors.duration}>
            Enter whole minutes, up to a day (1440).
          </FieldError>
        </Field>
        {create.isError && (
          <p
            role="alert"
            className="text-sm text-destructive-soft-foreground sm:col-span-2"
          >
            The booking couldn't be saved. Check the fields and try again.
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            Save booking
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Close
          </Button>
        </div>
      </form>
    </Card>
  );
}
