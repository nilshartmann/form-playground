import React from "react";

export default function ErrorDisplay(props: { errorMessages?: string[] }) {
    const errorMessages = props.errorMessages;
    return <div className="ErrorDisplay" >
        {errorMessages ?
            <ul data-testid="error-display">{errorMessages.map((msg, ix) => <li data-testid="error-message" key={ix}>{msg}</li>)}</ul> :
            ''
        }
    </div>
}