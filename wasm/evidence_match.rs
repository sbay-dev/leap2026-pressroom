#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

#[no_mangle]
pub extern "C" fn evidence_match(expected: i32, observed: i32) -> i32 {
    i32::from(expected == observed)
}
