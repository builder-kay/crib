import { z } from "zod";

export const authLoginSchema = z.object({
  identifier: z.string().min(3, "Enter your email or mobile number."),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

export const authRegisterSchema = z.object({
  display_name: z.string().min(2, "Creative name must be at least 2 characters.").max(80),
  phone: z.string().min(6, "Enter your mobile number."),
  email: z.string().email("Enter a valid email address.").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

export const authOtpCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "Enter the OTP code sent to your phone.")
});

export const authResetRequestSchema = z.object({
  identifier: z.string().min(3, "Enter the email or mobile number tied to your account.")
});

export const authResetVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "Enter the OTP code sent to your phone."),
  new_password: z.string().min(6, "New password must be at least 6 characters.")
});
