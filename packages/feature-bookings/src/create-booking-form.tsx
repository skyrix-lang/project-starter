import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
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
  toast,
} from "@booking/ui";
import { NAMESPACE } from "./messages";

type FormInput = z.input<typeof createBookingSchema>;
type FormOutput = z.output<typeof createBookingSchema>;

/**
 * Validates with the same schema as the BFF, so the browser and the server
 * agree on what a valid booking is. The server still checks: this is for speed.
 */
export function CreateBookingForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const create = useCreateBooking();
  const { t } = useTranslation(NAMESPACE);
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
    toast({ title: t("form.saved") });
    onDone();
  });

  return (
    <Card>
      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="grid gap-4 sm:grid-cols-2"
      >
        <h2 className="text-lg font-semibold sm:col-span-2">
          {t("form.heading")}
        </h2>
        <Field invalid={!!errors.title} className="sm:col-span-2">
          <FieldLabel>{t("form.title")}</FieldLabel>
          <Input {...register("title")} />
          <FieldError match={!!errors.title}>{t("form.titleError")}</FieldError>
        </Field>
        <Field invalid={!!errors.description} className="sm:col-span-2">
          <FieldLabel>{t("form.description")}</FieldLabel>
          <Input {...register("description")} />
          <FieldError match={!!errors.description}>
            {t("form.descriptionError")}
          </FieldError>
        </Field>
        <Field invalid={!!errors.date}>
          <FieldLabel>{t("form.date")}</FieldLabel>
          <Input type="date" {...register("date")} />
          <FieldError match={!!errors.date}>{t("form.dateError")}</FieldError>
        </Field>
        <Field invalid={!!errors.time}>
          <FieldLabel>{t("form.time")}</FieldLabel>
          <Input type="time" {...register("time")} />
          <FieldError match={!!errors.time}>{t("form.timeError")}</FieldError>
        </Field>
        <Field invalid={!!errors.duration}>
          <FieldLabel>{t("form.duration")}</FieldLabel>
          <Input
            type="number"
            min={1}
            max={1440}
            {...register("duration", { valueAsNumber: true })}
          />
          <FieldError match={!!errors.duration}>
            {t("form.durationError")}
          </FieldError>
        </Field>
        {create.isError && (
          <p
            role="alert"
            className="text-sm text-destructive-soft-foreground sm:col-span-2"
          >
            {t("form.failed")}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={isSubmitting}>
            {t("form.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            {t("form.close")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
