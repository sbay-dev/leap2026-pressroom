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

#[no_mangle]
pub extern "C" fn flag_bit(flag: i32, bit: i32) -> i32 {
    if !(0..8).contains(&bit) {
        return 0;
    }
    (((flag as u32) & 0xff) >> bit) as i32 & 1
}

#[no_mangle]
pub extern "C" fn flag_popcount(flag: i32) -> i32 {
    ((flag as u32) & 0xff).count_ones() as i32
}

#[no_mangle]
pub extern "C" fn trace_void() {}
