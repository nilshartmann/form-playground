import React, { useState } from "react";
import { render, fireEvent, cleanup, waitForElement, wait, getByText } from 'react-testing-library'
// this adds custom jest matchers from jest-dom

import OrderForm from './OrderForm';
import ErrorDisplay from './form/errorDisplay';
afterEach(cleanup);

const nachnameTooShort = 'Der Nachname muss mindestens 3 Zeichen lang sein';
const nachnameShoterThanVorname = 'Vorname muss kürzer als Nachname sein';

it('should display no validation errors when opened', () => {
    const wrapper = render(<OrderForm submit={() => { }} />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
});
it('should not display a validation error when vorname was blurred', () => {
    const wrapper = render(<OrderForm submit={() => { }} />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
    const inputElement = wrapper.getByLabelText('Vorname');
    fireEvent.blur(inputElement);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
});
it('should display a validation error when nachname was blurred', () => {
    const wrapper = render(<OrderForm submit={() => { }} />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
    const inputElement = wrapper.getByLabelText('Nachname');
    fireEvent.blur(inputElement);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(1);
});
it('should display two validation errors when vor- and nachname was blurred', () => {
    const wrapper = render(<OrderForm submit={() => { }} />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
    fireEvent.blur(wrapper.getByLabelText('Vorname'));
    fireEvent.blur(wrapper.getByLabelText('Nachname'));
    const errors = wrapper.queryAllByTestId("error-message");

    expect(errors).toHaveLength(2);
    expectError(errors, nachnameTooShort);
    expectError(errors, nachnameShoterThanVorname);
});
it('should disable submit button if errors present', () => {
    const wrapper = render(<OrderForm submit={() => { }} />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
    const submit = wrapper.getByText('Bestellen !');
    fireEvent.click(submit);
    const errors = wrapper.queryAllByTestId("error-message");
    expect(errors.length).toBeGreaterThan(0);
    expect((submit as HTMLButtonElement).disabled).toBe(true);
});
it('should display validating when async validation is triggered', async () => {
    const wrapper = render(<OrderForm submit={() => { }} />);
    const plzField = wrapper.getByLabelText('PLZ') as HTMLInputElement;
    fireEvent.click(plzField);
    fireEvent.change(plzField, {
        target: { value: '11111' },
    });
    fireEvent.blur(plzField);
    const validatingText = 'validating...';

    expect(wrapper.getByText(validatingText)).toBe;

    await wait(() => { expect(wrapper.queryAllByText(validatingText)).toHaveLength(0) });
});
it('should submit', async () => {
    const submitted = { submitted: false };
    const wrapper = render(<OrderForm submit={() => { submitted.submitted = true }} />);
    const plzField = wrapper.getByLabelText('PLZ') as HTMLInputElement;
    const nameField = wrapper.getByLabelText('Nachname') as HTMLInputElement;
    const vornameField = wrapper.getByLabelText('Vorname') as HTMLInputElement;
    const addPizzaButton = wrapper.getByText('Pizza hinzufügen') as HTMLInputElement;
    const submitButton = wrapper.getByText('Bestellen !') as HTMLInputElement;
    fireEvent.click(addPizzaButton);
    const groesseField = wrapper.getByLabelText('Größe') as HTMLInputElement;
    expect(groesseField).toBe;
    fireChange(vornameField, 'Chuck');
    fireChange(nameField, 'Norris');
    fireEvent.change(plzField, {
        target: { value: '22300' },
    });
    fireEvent.blur(plzField);
    expect(plzField.value).toEqual('22300');
    fireChange(groesseField, '20');
    await wait(() => { return true; });
    fireEvent.click(submitButton);
    await wait(() => { return true; });

    expect(submitted.submitted).toEqual(true);
});
it('should ignore outdated validation responses', async () => {
    const submitted = { submitted: false };
    const wrapper = render(<OrderForm submit={() => { submitted.submitted = true }} />);
    const plzField = wrapper.getByLabelText('PLZ') as HTMLInputElement;
    fireEvent.change(plzField, {
        target: { value: '22305' },
    });
    fireEvent.blur(plzField);
    fireEvent.change(plzField, {
        target: { value: '22302' },
    });
    fireEvent.blur(plzField);
    const greetingTextNode = await waitForElement(() =>
        wrapper.getByText('Postleitzahl nicht im Liefergebiet',)
    )
    expect(greetingTextNode).toBe
});
function fireChange(input: HTMLInputElement, value: string | number) {
    fireEvent.change(input, {
        target: { value },
    });

}

function expectError(errors: HTMLElement[], expected: string) {
    const found = errors.find(e => e.innerHTML === expected) !== undefined;
    expect(found).toBe(true);

}