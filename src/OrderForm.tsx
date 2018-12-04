import React from "react";
// UI (independent from useForm hook)
import { Input } from "./form/Input";

// Form Logic
import { ValidateFn, useForm } from "./form/useForm";

interface OrderFormState {
  vorname: string;
  nachname: string;
  plz: string;
}

// validatePizzaForm jetzt "kontextlos", dh zum Beispiel von außen testbar
const validatePizzaForm: ValidateFn<OrderFormState> = function(
  newFormInput,
  isVisited,
  recordError
) {
  if (newFormInput.vorname === "a") {
    window.setTimeout(() => recordError("vorname", "NAY"),5000);
  }

  if (isVisited("vorname") && newFormInput.vorname.length < 3) {
    recordError("vorname", "Der Vorname muss mindestens 3 Zeichen lang sein");
  }

  if (isVisited("nachname") && newFormInput.nachname.length < 3) {
    recordError("nachname", "Der Nachname muss mindestens 3 Zeichen lang sein");
  }

  if (isVisited("vorname") && isVisited("nachname")) {
    if (newFormInput.vorname.length >= newFormInput.nachname.length) {
      recordError("nachname", "Vorname muss kürzer als Nachname sein");
    }
  }
};

export default function OrderForm() {
  function submit() {
    console.log("submitting", overallFormState.values);
  }

  const [overallFormState, [vornameInput, nachnameInput, plzInput]] = useForm<
    OrderFormState
  >(validatePizzaForm, {
    vorname: "",
    nachname: "",
    plz: ""
  }, submit);


  return (
    <div className="Form">
      <Input label="Vorname" {...vornameInput} />
      <Input label="Nachname" {...nachnameInput} />
      <Input label="PLZ" {...plzInput} />
      <button onClick={() => overallFormState.setValue("plz", "")}>
        Clear PLZ
      </button>
      <button disabled={overallFormState.hasErrors} onClick={overallFormState.handleSubmit}>
        Bestellen !
      </button>
    </div>
  );
}
