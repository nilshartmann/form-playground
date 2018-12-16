import React, { useState } from "react";
import { render, fireEvent, cleanup, waitForElement,wait } from 'react-testing-library'
// this adds custom jest matchers from jest-dom

import OrderForm from './OrderForm';
import ErrorDisplay from './form/errorDisplay';
afterEach(cleanup);

const nachnameTooShort = 'Der Nachname muss mindestens 3 Zeichen lang sein';
const nachnameShoterThanVorname = 'Vorname muss kürzer als Nachname sein';

it('should display no validation errors when opened', () => {
    const wrapper = render(<OrderForm />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
});
it('should not display a validation error when vorname was blurred', () => {
    const wrapper = render(<OrderForm />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
    const inputElement = wrapper.getByLabelText('Vorname');
    fireEvent.blur(inputElement);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
});
it('should display a validation error when nachname was blurred', () => {
    const wrapper = render(<OrderForm />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
    const inputElement = wrapper.getByLabelText('Nachname');
    fireEvent.blur(inputElement);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(1);
});
it('should display two validation errors when vor- and nachname was blurred', () => {
    const wrapper = render(<OrderForm />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
    fireEvent.blur(wrapper.getByLabelText('Vorname'));
    fireEvent.blur(wrapper.getByLabelText('Nachname'));
    const errors = wrapper.queryAllByTestId("error-message");

    expect(errors).toHaveLength(2);
    expectError(errors, nachnameTooShort);
    expectError(errors, nachnameShoterThanVorname);
});
it('should disable submit button if errors present', () => {
    const wrapper = render(<OrderForm />);
    expect(wrapper.queryAllByTestId("error-display")).toHaveLength(0);
    const submit = wrapper.getByText('Bestellen !');
    fireEvent.click(submit);
    const errors = wrapper.queryAllByTestId("error-message");
    expect(errors.length).toBeGreaterThan(0);
    expect((submit as HTMLButtonElement).disabled).toBe(true);
});
it('should display validating when async validation is triggered', async () => {
    const wrapper = render(<OrderForm />);
    const plzField = wrapper.getByLabelText('PLZ') as HTMLInputElement;
    fireEvent.click(plzField);
    fireEvent.change(plzField, {
        target: { value: '99999' },
    });
    fireEvent.blur(plzField, { target: { value: '99999' } });
    const validatingText='validating...';

    expect(wrapper.getByText(validatingText)).toBe;

    await wait(() => {expect(wrapper.queryAllByText(validatingText)).toHaveLength(0)});
});

function expectError(errors: HTMLElement[], expected: string) {
    const found = errors.find(e => e.innerHTML === expected) !== undefined;
    expect(found).toBe(true);

}